import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import AppHeader from '../../components/ui/AppHeader';
import ThemedView from '../../components/ThemedView';
import { blogAPI } from '../../services/apiClient';
import { Helmet } from 'react-helmet-async';

const ORANGE = '#F68B3C';
const NAVY   = '#1A1A2E';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ─── Inline markdown parser ──────────────────────────────────────────────────
// Handles **bold**, *italic*, and combinations within a single line of text.
function parseInline(text, baseStyle, boldColor) {
  const parts = [];
  // Split on **bold** and *italic* tokens
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), bold: false, italic: false });
    }
    if (match[0].startsWith('**')) {
      parts.push({ text: match[2], bold: true, italic: false });
    } else {
      parts.push({ text: match[3], bold: false, italic: true });
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push({ text: text.slice(last), bold: false, italic: false });
  }

  if (parts.length === 0) return null;

  return (
    <Text style={baseStyle}>
      {parts.map((p, i) => (
        <Text
          key={i}
          style={[
            p.bold   && { fontWeight: '800', color: boldColor },
            p.italic && { fontStyle: 'italic' },
          ]}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

// ─── Block-level markdown renderer ──────────────────────────────────────────
const MarkdownContent = ({ content, c, isDark }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Skip blank lines but add spacing
    if (!line.trim()) {
      elements.push(<View key={`gap-${i}`} style={{ height: 8 }} />);
      i++;
      continue;
    }

    // H2 — ## Heading
    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      elements.push(
        <Text key={i} style={[s.mdH2, { color: c.textPrimary }]}>{text}</Text>
      );
      i++;
      continue;
    }

    // H3 — ### Heading
    if (line.startsWith('### ')) {
      const text = line.slice(4).trim();
      elements.push(
        <Text key={i} style={[s.mdH3, { color: c.textPrimary }]}>{text}</Text>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---') {
      elements.push(
        <View key={i} style={[s.mdHr, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.1)' }]} />
      );
      i++;
      continue;
    }

    // Blockquote — > text
    if (line.startsWith('> ')) {
      const text = line.slice(2).trim();
      elements.push(
        <View key={i} style={[s.mdQuote, { borderLeftColor: ORANGE, backgroundColor: ORANGE + '12' }]}>
          {parseInline(text, [s.mdQuoteText, { color: c.textSecondary }], c.textPrimary)
            || <Text style={[s.mdQuoteText, { color: c.textSecondary }]}>{text}</Text>}
        </View>
      );
      i++;
      continue;
    }

    // Unordered bullet — • or -
    if (line.startsWith('• ') || line.startsWith('- ')) {
      const text = line.slice(2).trim();
      elements.push(
        <View key={i} style={s.mdBulletRow}>
          <View style={[s.mdBulletDot, { backgroundColor: ORANGE }]} />
          {parseInline(text, [s.mdBulletText, { color: c.textPrimary }], c.textPrimary)
            || <Text style={[s.mdBulletText, { color: c.textPrimary }]}>{text}</Text>}
        </View>
      );
      i++;
      continue;
    }

    // Ordered list — 1. 2. 3. etc.
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      const num = orderedMatch[1];
      const text = orderedMatch[2].trim();
      elements.push(
        <View key={i} style={s.mdBulletRow}>
          <Text style={[s.mdOrderedNum, { color: ORANGE }]}>{num}.</Text>
          {parseInline(text, [s.mdBulletText, { color: c.textPrimary }], c.textPrimary)
            || <Text style={[s.mdBulletText, { color: c.textPrimary }]}>{text}</Text>}
        </View>
      );
      i++;
      continue;
    }

    // Checklist — ✅ prefix
    if (line.startsWith('✅') || line.startsWith('☐')) {
      const done = line.startsWith('✅');
      const text = line.slice(done ? 1 : 1).trim();
      elements.push(
        <View key={i} style={s.mdBulletRow}>
          <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={done ? '#10b981' : c.textTertiary} />
          <Text style={[s.mdBulletText, { color: c.textPrimary, textDecorationLine: done ? 'line-through' : 'none' }]}>{text}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Plain paragraph with possible inline formatting
    elements.push(
      <View key={i} style={{ marginBottom: 6 }}>
        {parseInline(line, [s.mdParagraph, { color: c.textPrimary }], c.textPrimary)
          || <Text style={[s.mdParagraph, { color: c.textPrimary }]}>{line}</Text>}
      </View>
    );
    i++;
  }

  return <View>{elements}</View>;
};

// ─── Screen ──────────────────────────────────────────────────────────────────
const BlogPostScreen = ({ navigation, route }) => {
  const { postId } = route.params;
  const { theme, isDark } = useTheme();
  const c = theme.colors;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    try {
      const res = await blogAPI.getPost(postId);
      if (res.success) setPost(res.post);
      else setError('Post not found');
    } catch (e) {
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView colorKey="background" style={{ flex: 1 }}>
      <Helmet>
        <title>{post ? `${post.title} - SkillSphere Blog` : 'Blog Post - SkillSphere'}</title>
        <meta name="description" content={post?.excerpt || post?.summary || 'Read this article on the SkillSphere blog.'} />
        <link rel="canonical" href={`https://skillsphere.com.pk/blog/${postId}`} />
      </Helmet>
      <AppHeader showBack={true} showDateTime={false} minimal={true} title="Article" />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={ORANGE} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Icon name="alert-circle-outline" size={48} color={c.textSecondary} />
          <Text style={[s.errorText, { color: c.textSecondary }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>

          {/* Tag */}
          <View style={[s.tagBadge, { backgroundColor: (post.tagColor || ORANGE) + '20' }]}>
            <Icon name={post.coverIcon || 'newspaper-outline'} size={13} color={post.tagColor || ORANGE} />
            <Text style={[s.tagText, { color: post.tagColor || ORANGE }]}>{post.tag}</Text>
          </View>

          {/* Title */}
          <Text style={[s.title, { color: c.textPrimary }]}>{post.title}</Text>

          {/* Meta */}
          <View style={s.metaRow}>
            <Icon name="person-circle-outline" size={14} color={c.textSecondary} />
            <Text style={[s.metaText, { color: c.textSecondary }]}>{post.author}</Text>
            <View style={[s.metaDot, { backgroundColor: c.textSecondary }]} />
            <Text style={[s.metaText, { color: c.textSecondary }]}>{formatDate(post.publishedAt)}</Text>
            <View style={[s.metaDot, { backgroundColor: c.textSecondary }]} />
            <Icon name="time-outline" size={13} color={c.textSecondary} />
            <Text style={[s.metaText, { color: c.textSecondary }]}>{post.readTime}</Text>
          </View>

          {/* Divider */}
          <View style={[s.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)' }]} />

          {/* Excerpt */}
          <Text style={[s.excerpt, { color: c.textSecondary }]}>{post.excerpt}</Text>

          {/* Content — rendered as markdown */}
          <MarkdownContent content={post.content} c={c} isDark={isDark} />

          {/* Footer */}
          <View style={[s.footer, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)' }]}>
            <TouchableOpacity
              style={[s.backBtnBottom, { backgroundColor: NAVY }]}
              onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={16} color="#fff" />
              <Text style={s.backBtnText}>Back to Blog</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </ThemedView>
  );
};

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 15 },
  tagBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 14,
  },
  tagText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '900', lineHeight: 30, marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 18 },
  metaText: { fontSize: 12 },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  divider: { height: 1, marginBottom: 18 },
  excerpt: { fontSize: 15, lineHeight: 24, fontStyle: 'italic', marginBottom: 20 },
  footer: { marginTop: 36, paddingTop: 20, borderTopWidth: 1 },
  backBtnBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Markdown styles ─────────────────────────────────────────────────────
  mdH2: { fontSize: 20, fontWeight: '800', lineHeight: 28, marginTop: 20, marginBottom: 8 },
  mdH3: { fontSize: 17, fontWeight: '700', lineHeight: 24, marginTop: 16, marginBottom: 6 },
  mdHr: { height: 1.5, borderRadius: 1, marginVertical: 20 },
  mdQuote: {
    borderLeftWidth: 4, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    marginVertical: 10,
  },
  mdQuoteText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  mdBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6, paddingLeft: 4 },
  mdBulletDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 9, flexShrink: 0 },
  mdOrderedNum: { fontSize: 14, fontWeight: '700', lineHeight: 24, width: 22, flexShrink: 0 },
  mdBulletText: { flex: 1, fontSize: 15, lineHeight: 24 },
  mdParagraph: { fontSize: 15, lineHeight: 26 },
});

export default BlogPostScreen;
