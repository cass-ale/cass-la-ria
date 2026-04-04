/**
 * Cass la Ria - i18n Translation Dictionary
 * 
 * Translations crafted using the Poetic Translation skill.
 * 
 * Tier 1 (Brand): "Cass la Ria" (Never translated)
 * Tier 2 (UI): "Contact", "Skip to content", "Email copied!" (Domesticated)
 * Tier 3 (Creative): "Multi-faceted creative — music, video, and visual art." (Transcreated)
 */

const translations = {
  // English (Default)
  'en': {
    'name': 'Cass la Ria',
    'skip-link': 'Skip to content',
    'contact-btn': 'Contact',
    'email-copied': 'Email copied!',
    'meta-desc': 'Official website of Cass la Ria. Multi-faceted creative — music, video, and visual art.',
    'meta-title': 'Cass la Ria | Official Website',
    'error-404-message': 'This page was lost in the rain',
    'error-home-btn': 'Return Home'
  },

  // Spanish (ES) - Romance: Requires expansion, edit ruthlessly to prevent bloat
  'es': {
    'name': 'Cass la Ria',
    'skip-link': 'Saltar al contenido',
    'contact-btn': 'Contacto',
    'email-copied': '¡Correo copiado!',
    'meta-desc': 'Sitio web oficial de Cass la Ria. Mente creativa sin fronteras: música, video y arte visual.',
    'meta-title': 'Cass la Ria | Sitio Oficial',
    'error-404-message': 'Esta página se perdió bajo la lluvia',
    'error-home-btn': 'Volver al Inicio'
  },

  // Portuguese (PT-BR) - Romance: Warmth and rhythm
  'pt': {
    'name': 'Cass la Ria',
    'skip-link': 'Pular para o conteúdo',
    'contact-btn': 'Contato',
    'email-copied': 'E-mail copiado!',
    'meta-desc': 'Site oficial de Cass la Ria. Uma mente criativa plural — música, vídeo e arte visual.',
    'meta-title': 'Cass la Ria | Site Oficial',
    'error-404-message': 'Esta página se perdeu na chuva',
    'error-home-btn': 'Voltar ao Início'
  },

  // French (FR) - Romance: Euphony and elegance
  'fr': {
    'name': 'Cass la Ria',
    'skip-link': 'Passer au contenu',
    'contact-btn': 'Contact',
    'email-copied': 'E-mail copié !',
    'meta-desc': 'Site officiel de Cass la Ria. Esprit créatif pluriel — musique, vidéo et art visuel.',
    'meta-title': 'Cass la Ria | Site Officiel',
    'error-404-message': 'Cette page s\u2019est perdue sous la pluie',
    'error-home-btn': 'Retour à l\u2019Accueil'
  },

  // Japanese (JA) - Yūgen: Say less, mean more. Concrete images.
  'ja': {
    'name': 'Cass la Ria',
    'skip-link': 'メインコンテンツへ',
    'contact-btn': 'コンタクト',
    'email-copied': 'コピーしました',
    'meta-desc': 'Cass la Ria 公式サイト。音楽、映像、視覚芸術の交差点。',
    'meta-title': 'Cass la Ria | 公式サイト',
    'error-404-message': '雨に消えたページ',
    'error-home-btn': 'ホームへ戻る'
  },

  // Korean (KO) - Han/Jeong: Emotional weight, warmth, oral quality
  'ko': {
    'name': 'Cass la Ria',
    'skip-link': '본문으로 건너뛰기',
    'contact-btn': '연락하기',
    'email-copied': '이메일 복사됨!',
    'meta-desc': 'Cass la Ria 공식 웹사이트. 음악, 영상, 시각 예술을 아우르는 크리에이티브.',
    'meta-title': 'Cass la Ria | 공식 웹사이트',
    'error-404-message': '빗속에 사라진 페이지',
    'error-home-btn': '홈으로 돌아가기'
  },

  // Indonesian (ID) - Direct, natural, rhythmic
  'id': {
    'name': 'Cass la Ria',
    'skip-link': 'Lanjut ke konten',
    'contact-btn': 'Kontak',
    'email-copied': 'Email disalin!',
    'meta-desc': 'Situs resmi Cass la Ria. Kreator multi-dimensi — musik, video, dan seni visual.',
    'meta-title': 'Cass la Ria | Situs Resmi',
    'error-404-message': 'Halaman ini hilang di tengah hujan',
    'error-home-btn': 'Kembali ke Beranda'
  },

  // Chinese Simplified (ZH) - Qi yun: Compress ruthlessly. Every character must be necessary.
  'zh': {
    'name': 'Cass la Ria',
    'skip-link': '跳至正文',
    'contact-btn': '联络',
    'email-copied': '已复制邮箱',
    'meta-desc': 'Cass la Ria 官方网站。跨界创作者——音乐、影像、视觉艺术。',
    'meta-title': 'Cass la Ria | 官方网站',
    'error-404-message': '此页已消散于雨中',
    'error-home-btn': '返回首页'
  }
};

// Language names in their native script for the switcher UI
const languageNames = {
  'en': 'English',
  'es': 'Español',
  'pt': 'Português',
  'fr': 'Français',
  'ja': '日本語',
  'ko': '한국어',
  'id': 'Bahasa Indonesia',
  'zh': '中文'
};

// Export for use in main.js
window.i18n = {
  translations,
  languageNames,
  defaultLang: 'en'
};
