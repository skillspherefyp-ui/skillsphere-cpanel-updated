// OTP Utility Functions
const crypto = require('crypto');

// Generate a cryptographically secure random 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Hash OTP with SHA-256 for secure storage
const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

// Get OTP expiry time (10 minutes from now)
const getOTPExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

// Check if OTP is expired
const isOTPExpired = (expiryDate) => {
  if (!expiryDate) return true;
  return new Date() > new Date(expiryDate);
};

// Validate OTP format (must be 6 digits)
const isValidOTPFormat = (otp) => {
  return /^\d{6}$/.test(otp);
};

// Verify OTP
const verifyOTP = (inputOTP, storedOTP, expiryDate) => {
  // Check format
  if (!isValidOTPFormat(inputOTP)) {
    return { valid: false, message: 'Invalid OTP format. Must be 6 digits.' };
  }

  // Check if OTP matches (timing-safe comparison against stored hash)
  const inputHash = crypto.createHash('sha256').update(inputOTP).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedOTP))) {
      return { valid: false, message: 'Invalid OTP code.' };
    }
  } catch {
    return { valid: false, message: 'Invalid OTP code.' };
  }

  // Check if OTP is expired
  if (isOTPExpired(expiryDate)) {
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }

  return { valid: true, message: 'OTP verified successfully.' };
};

module.exports = {
  generateOTP,
  hashOTP,
  getOTPExpiry,
  isOTPExpired,
  isValidOTPFormat,
  verifyOTP
};
