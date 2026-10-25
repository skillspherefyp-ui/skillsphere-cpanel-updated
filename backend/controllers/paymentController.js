const https = require('https');
const crypto = require('crypto');

const SAFEPAY_ENV         = process.env.SAFEPAY_ENV    || 'sandbox';
const SAFEPAY_SECRET      = process.env.SAFEPAY_SECRET_KEY;
const SAFEPAY_CLIENT      = process.env.SAFEPAY_PUBLIC_KEY; // public key = "client"
const SAFEPAY_API_HOST      = SAFEPAY_ENV === 'production'
  ? 'api.getsafepay.com'
  : 'sandbox.api.getsafepay.com';
const SAFEPAY_CHECKOUT_BASE = SAFEPAY_ENV === 'production'
  ? 'https://getsafepay.com'
  : 'https://sandbox.api.getsafepay.com';

const CERT_PRICE_PKR = 2000;

// ── HTTPS helper (no axios needed) ─────────────────────────────────────────
function safepayRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SAFEPAY_API_HOST,
      path,
      method,
      headers: {
        'X-SFPY-MERCHANT-SECRET': SAFEPAY_SECRET,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── POST /api/payments/create-order ────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    const orderId = `SS-${userId}-${courseId}-${Date.now()}`;

    const response = await safepayRequest('POST', '/order/v1/init', {
      client:      SAFEPAY_CLIENT,
      environment: SAFEPAY_ENV,
      amount:      CERT_PRICE_PKR,
      currency:    'PKR',
      order_id:    orderId,
    });

    if (response.status !== 200 && response.status !== 201) {
      console.error('Safepay create-order error:', response.body);
      return res.status(502).json({ error: 'Failed to create payment session with Safepay' });
    }

    const tracker = response.body?.data?.token;
    if (!tracker) {
      console.error('No tracker token in Safepay response:', response.body);
      return res.status(502).json({ error: 'Invalid response from Safepay' });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'https://skillsphere.com.pk').replace(/\/$/, '');
    const redirectUrl = encodeURIComponent(`${frontendUrl}/student/payment?action=complete&courseId=${courseId}`);
    const cancelUrl   = encodeURIComponent(`${frontendUrl}/student/payment?courseId=${courseId}`);
    const checkoutUrl = `${SAFEPAY_CHECKOUT_BASE}/checkout/pay?beacon=${tracker}&order_id=${orderId}&source=woocommerce&webhooks=true&env=${SAFEPAY_ENV}&redirect_url=${redirectUrl}&cancel_url=${cancelUrl}`;

    res.json({ success: true, orderId, tracker, checkoutUrl, amount: CERT_PRICE_PKR });
  } catch (err) {
    console.error('Create payment order error:', err.message);
    res.status(500).json({ error: 'Payment service unavailable' });
  }
};

// ── POST /api/payments/verify ───────────────────────────────────────────────
// Called by frontend after user returns from Safepay checkout
exports.verifyPayment = async (req, res) => {
  try {
    const { tracker, courseId } = req.body;
    const userId = req.user.id;

    if (!tracker || !courseId) {
      return res.status(400).json({ error: 'tracker and courseId are required' });
    }

    const response = await safepayRequest('GET', `/order/v1/${tracker}`);

    console.log('[Safepay verify] status:', response.status, 'state:', response.body?.data?.state, 'body:', JSON.stringify(response.body));

    if (response.status !== 200) {
      console.error('Safepay tracker lookup error:', response.body);
      return res.status(400).json({ error: 'Could not verify payment status' });
    }

    // Safepay may nest state differently depending on API version
    const state = response.body?.data?.state
      || response.body?.data?.tracker?.state
      || response.body?.state;
    const PAID_STATES = [
      'PAID', 'TRACKER_PAID',
      'COMPLETED', 'TRACKER_COMPLETED',
      'SUCCESS', 'AUTHORIZED', 'CAPTURED',
      'TRACKER_AUTHORIZED', 'TRACKER_CAPTURED',
      'TRACKER_ENDED',   // Safepay sandbox/production success state
    ];
    if (!PAID_STATES.includes(state)) {
      return res.status(400).json({
        error: 'Payment not completed yet',
        state: state || 'UNKNOWN',
      });
    }

    const d = response.body?.data;
    const safepayOrderId =
      d?.order_id ||
      d?.tracker?.order_id ||
      d?.order?.order_id ||
      d?.metadata?.order_id ||
      d?.tracker?.metadata?.order_id ||
      null;

    if (safepayOrderId) {
      // Ownership check — only runs when Safepay returns the order_id
      if (!safepayOrderId.startsWith(`SS-${req.user.id}-`)) {
        return res.status(403).json({ error: 'Payment verification failed: order does not belong to this user' });
      }
      const orderParts = safepayOrderId.split('-');
      if (String(orderParts[2]) !== String(courseId)) {
        return res.status(403).json({ error: 'Payment verification failed: order course mismatch' });
      }
    } else {
      console.warn('[Safepay verify] order_id not found in response — skipping ownership check. body:', JSON.stringify(response.body));
    }

    const certificate = await issueCertificate(userId, courseId, req, safepayOrderId);
    res.json({ success: true, certificate });
  } catch (err) {
    console.error('Verify payment error:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// ── POST /api/payments/webhook ──────────────────────────────────────────────
// Safepay calls this URL on payment events — register it in Safepay dashboard
exports.webhook = async (req, res) => {
  res.json({ received: true }); // always respond fast

  try {
    // Mandatory signature verification
    const signature = req.headers['x-sfpy-signature'];
    if (!signature || !SAFEPAY_SECRET) {
      console.error('Webhook: missing signature or secret — rejecting');
      return;
    }
    const expected = crypto
      .createHmac('sha256', SAFEPAY_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
        console.error('Webhook: invalid signature');
        return;
      }
    } catch {
      console.error('Webhook: malformed signature');
      return;
    }

    const { event, data } = req.body || {};
    if (event === 'payment:created' && data?.state === 'PAID') {
      const orderId = data?.order_id || '';
      // orderId format: SS-{userId}-{courseId}-{timestamp}
      const parts = orderId.split('-');
      if (parts.length >= 3) {
        const userId   = parts[1];
        const courseId = parts[2];
        await issueCertificate(userId, courseId, null, orderId);
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
};

// ── Shared: issue certificate after payment ─────────────────────────────────
async function issueCertificate(userId, courseId, req, safepayOrderId = null) {
  const { Certificate, Course, User, CertificateTemplate, TemplateCourse, Enrollment } = require('../models');
  const { generateAndSaveCertificate } = require('../services/certificateService');
  const { sendCertificateEmail } = require('../services/emailService');

  // Idempotent — don't double-issue
  const existing = await Certificate.findOne({ where: { userId, courseId } });
  if (existing) return existing;

  // Require course completion before issuing certificate
  const enrollment = await Enrollment.findOne({ where: { userId, courseId, status: 'completed' } });
  if (!enrollment) throw new Error(`User ${userId} has not completed course ${courseId}`);

  const [course, user] = await Promise.all([
    Course.findByPk(courseId),
    User.findByPk(userId),
  ]);
  if (!course || !user) throw new Error(`User ${userId} or course ${courseId} not found`);

  const certNumber = `CERT-${userId}-${courseId}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const verificationUrl = req
    ? `${req.protocol}://${req.get('host')}/api/certificates/verify/${certNumber}`
    : `${process.env.FRONTEND_URL}/verify/${certNumber}`;

  // Find certificate template
  let template = null;
  try {
    const assignment = await TemplateCourse.findOne({ where: { courseId, isActive: true } });
    if (assignment) {
      template = await CertificateTemplate.findByPk(assignment.templateId, {
        include: [{ model: User, as: 'creator', attributes: ['id', 'instructorSignature'] }],
      });
    }
    if (!template) {
      template = await CertificateTemplate.findOne({ where: { isActive: true } });
    }
  } catch (_) {}

  const templateSnapshot = template ? {
    primaryColor:   template.primaryColor,
    secondaryColor: template.secondaryColor,
    backgroundColor: template.backgroundColor,
    titleText:      template.titleText,
    subtitleText:   template.subtitleText,
    footerText:     template.footerText,
  } : null;

  const certificate = await Certificate.create({
    userId,
    courseId,
    certificateNumber: certNumber,
    verificationUrl,
    grade: 'Pass',
    issuedDate: new Date(),
    courseName: course.name,
    templateSnapshot,
  });

  // Generate PDF and email
  try {
    const { pdfBuffer, certificateUrl } = await generateAndSaveCertificate(
      {
        studentName:         user.name,
        courseName:          course.name,
        certificateNumber:   certNumber,
        issueDate:           new Date(),
        grade:               'Pass',
        frontendUrl:         process.env.FRONTEND_URL,
        instructorSignature: template?.creator?.instructorSignature || null,
      },
      template
    );
    await certificate.update({ certificateUrl });
    await sendCertificateEmail(user.email, user.name, course.name, certNumber, pdfBuffer, safepayOrderId);
    console.log(`📧 Certificate emailed to ${user.email}`);
  } catch (err) {
    console.error('⚠️  Certificate PDF/email error:', err.message);
  }

  return certificate;
}
