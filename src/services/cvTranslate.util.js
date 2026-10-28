const PROTECTED_KEYS = new Set([
  'email',
  'phone',
  'website',
  'linkedin',
  'link',
  'year',
  'key',
  'type',
  'fullName',
  'company',
  'school',
  'issuer',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\//i;
const MOSTLY_NUMERIC_RE = /^[\d\s./+\-()]+$/;

export const SECTION_TITLE_KEYS = {
  summary: 'Profile',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certificates',
  languages: 'Languages',
  custom: 'Additional',
};

export const LOCALIZED_SECTION_TITLES = {
  fr: {
    summary: 'Profil professionnel',
    experience: 'Expérience professionnelle',
    education: 'Formation',
    skills: 'Compétences',
    projects: 'Projets & réalisations',
    certifications: 'Certifications',
    languages: 'Langues',
    custom: 'Informations complémentaires',
  },
  es: {
    summary: 'Perfil profesional',
    experience: 'Experiencia laboral',
    education: 'Educación y formación',
    skills: 'Habilidades',
    projects: 'Proyectos y logros',
    certifications: 'Certificaciones',
    languages: 'Idiomas',
    custom: 'Información adicional',
  },
  de: {
    summary: 'Profil',
    experience: 'Berufserfahrung',
    education: 'Ausbildung',
    skills: 'Fähigkeiten',
    projects: 'Projekte',
    certifications: 'Zertifikate',
    languages: 'Sprachen',
    custom: 'Zusätzliche Informationen',
  },
  pt: {
    summary: 'Perfil profissional',
    experience: 'Experiência profissional',
    education: 'Educação e formação',
    skills: 'Competências',
    projects: 'Projetos',
    certifications: 'Certificações',
    languages: 'Idiomas',
    custom: 'Informações adicionais',
  },
  ar: {
    summary: 'الملف الشخصي',
    experience: 'الخبرة المهنية',
    education: 'التعليم والمؤهلات',
    skills: 'المهارات',
    projects: 'المشاريع',
    certifications: 'الشهادات',
    languages: 'اللغات',
    custom: 'معلومات إضافية',
  },
  zh: {
    summary: '个人简介',
    experience: '工作经历',
    education: '教育背景',
    skills: '专业技能',
    projects: '项目经验',
    certifications: '资格证书',
    languages: '语言能力',
    custom: '补充信息',
  },
  tw: {
    summary: 'M’abrabɔ mu nsɛm',
    experience: 'Adwumaden suahunu',
    education: 'Nwomasua',
    skills: 'Nimdeɛ ne nnwuma',
    projects: 'Nnwuma atitiriw',
    certifications: 'Abodin krataa',
    languages: 'Kasa ahorow',
    custom: 'Nsɛm foforo',
  },
  ha: {
    summary: 'Tarihin Rayuwa',
    experience: 'Kwarewar Aiki',
    education: 'Ilimi',
    skills: 'Kwarewa da Hikima',
    projects: 'Ayyuka na Musamman',
    certifications: 'Takaddun Shaida',
    languages: 'Harsuna',
    custom: 'Karin Bayani',
  },
};

export function shouldSkipString(key, value) {
  if (!value || typeof value !== 'string') return true;
  const text = value.trim();
  if (!text) return true;
  if (PROTECTED_KEYS.has(key)) return true;
  if (EMAIL_RE.test(text) || URL_RE.test(text) || MOSTLY_NUMERIC_RE.test(text)) return true;
  return false;
}

function visit(value, path, out) {
  if (typeof value === 'string') {
    const key = path[path.length - 1];
    if (typeof key === 'string' && !shouldSkipString(key, value)) {
      out.push({ id: String(out.length), path, text: value });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => visit(item, [...path, i], out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'heading') continue;
      visit(v, [...path, k], out);
    }
  }
}

export function collectTranslatable(cv) {
  const items = [];
  if (cv?.title) {
    visit(cv.title, ['title'], items);
  }
  visit(cv?.sections || [], ['sections'], items);
  return items;
}

export function setAtPath(root, path, value) {
  if (!path.length) return value;
  let cursor = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    cursor = cursor[path[i]];
    if (cursor == null) return root;
  }
  cursor[path[path.length - 1]] = value;
  return root;
}

export function applyTranslations(cvPlain, pairs) {
  const next = structuredClone(cvPlain);
  for (const pair of pairs) {
    if (!pair?.path || typeof pair.text !== 'string') continue;
    setAtPath(next, pair.path, pair.text);
  }
  return next;
}

export function withLocalizedHeadings(cvPlain, headingMap) {
  const next = structuredClone(cvPlain);
  next.sections = (next.sections || []).map((section) => {
    const heading = headingMap?.[section.type];
    if (!heading) return section;
    return {
      ...section,
      data: { ...(section.data || {}), heading },
    };
  });
  return next;
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
