// lib/personas.client.js
// CLIENT-SAFE: what the browser is allowed to know. No system prompts here.

export const PERSONA_UI = {
  hitesh: {
    id: 'hitesh',
    name: 'Hitesh Choudhary',
    avatar: 'https://github.com/hiteshchoudhary.png',
    tagline: 'Chai aur Code · retired from corporate, full-time teacher',
    greeting:
      'Haan ji! Kaise hain aap? Swagat hai Chai aur Code mein. Chai le aao, aur batao — aaj kya seekhna hai? ☕',
    chips: [
      'Full-stack roadmap batao, kahan se shuru karu?',
      'DSA zaroori hai kya job ke liye?',
      'JavaScript closures samjhao simple example se',
      'GenAI mein career kaise banau?',
    ],
    links: [
      { label: 'chaicode.com', url: 'https://chaicode.com' },
      { label: 'YouTube', url: 'https://www.youtube.com/@chaiaurcode' },
      { label: 'X', url: 'https://x.com/Hiteshdotcom' },
    ],
    theme: {
      '--bg': '#171310',
      '--surface': '#221c17',
      '--surface-2': '#2b241d',
      '--border': '#3a3128',
      '--accent': '#e8a34c',
      '--accent-soft': 'rgba(232, 163, 76, 0.14)',
      '--text': '#f2ece3',
      '--text-dim': '#a89a88',
    },
  },
  piyush: {
    id: 'piyush',
    name: 'Piyush Garg',
    avatar: 'https://github.com/piyushgarg-dev.png',
    tagline: 'Builds software, teaches software · founder @ Teachyst',
    greeting:
      'Hey everyone! Piyush here 🙌 Batao, aaj kya build kar rahe hain? System design, GenAI, ya koi full-stack cheez?',
    chips: [
      'URL shortener ka system design walk through karo',
      'Docker vs VM — kab kya use karu?',
      'RAG app kaise banau JavaScript mein?',
      'Next.js seekhu ya pehle plain React?',
    ],
    links: [
      { label: 'piyushgarg.dev', url: 'https://www.piyushgarg.dev' },
      { label: 'YouTube', url: 'https://www.youtube.com/@piyushgargdev' },
      { label: 'X', url: 'https://x.com/piyushgarg_dev' },
    ],
    theme: {
      '--bg': '#0f1218',
      '--surface': '#161b24',
      '--surface-2': '#1d2430',
      '--border': '#2a3342',
      '--accent': '#7c8cf8',
      '--accent-soft': 'rgba(124, 140, 248, 0.14)',
      '--text': '#e9edf5',
      '--text-dim': '#8b95a8',
    },
  },
};

export const CHARCHA_UI = {
  id: 'charcha',
  name: 'Chai pe Charcha',
  tagline: 'Hitesh & Piyush, ek saath — poochho kuch bhi, dono ka take milega',
  greeting:
    'Dono aa gaye hain ☕ Ek sawaal poochho — pehle Hitesh apna take denge, phir Piyush react karega. Kabhi agree, kabhi thoda tashan.',
  chips: [
    'DSA vs Development — kis pe focus karu?',
    'AI ke zamane mein fresher kya seekhe?',
    'Next.js hype hai ya zaroori?',
    'College degree matter karti hai kya?',
  ],
  theme: {
    '--bg': '#101311',
    '--surface': '#181d1a',
    '--surface-2': '#1f2621',
    '--border': '#2c352f',
    '--accent': '#6fbf9f',
    '--accent-soft': 'rgba(111, 191, 159, 0.14)',
    '--text': '#eaf1ec',
    '--text-dim': '#93a49a',
    '--hitesh': '#e8a34c',
    '--piyush': '#7c8cf8',
  },
};

export const DAILY_LIMIT = 25;
