import type { Locale } from '@etyma/core';

/**
 * Landing-page copy that is not in the Glossa catalog yet.
 *
 * Glossa owns every runtime catalog, but this environment cannot publish to it, so the copy
 * added with the landing redesign lives here until it moves there. `satisfies` makes a
 * missing translation a compile error, the same guarantee the generated contract gives the
 * remote keys. `site-copy.glossa.json` holds the same strings in catalog shape, ready to
 * import.
 */
export interface SiteCopy {
  readonly seo: { readonly description: string };
  readonly hero: {
    readonly getStarted: string;
    readonly copy: string;
    readonly copied: string;
    readonly demoLabel: string;
    readonly demoHint: string;
    readonly countLabel: string;
    readonly matched: string;
    readonly source: string;
    readonly rendered: string;
    readonly userName: string;
  };
  readonly stack: { readonly title: string };
  readonly compare: {
    readonly eyebrow: string;
    readonly title: string;
    readonly body: string;
    readonly before: string;
    readonly after: string;
    readonly rows: readonly { readonly before: string; readonly after: string }[];
  };
  readonly features: {
    readonly mf2Title: string;
    readonly mf2Body: string;
    readonly routesTitle: string;
    readonly routesBody: string;
    readonly remoteTitle: string;
    readonly remoteBody: string;
    readonly signalsTitle: string;
    readonly signalsBody: string;
  };
  readonly start: {
    readonly eyebrow: string;
    readonly title: string;
    readonly body: string;
    readonly install: string;
    readonly define: string;
    readonly use: string;
    readonly docs: string;
  };
  readonly packages: {
    readonly npm: string;
    readonly descriptions: Readonly<Record<PackageName, string>>;
  };
  readonly faq: {
    readonly eyebrow: string;
    readonly title: string;
    readonly items: readonly { readonly question: string; readonly answer: string }[];
  };
  readonly footer: {
    readonly product: string;
    readonly project: string;
    readonly languages: string;
    readonly releases: string;
    readonly license: string;
    readonly issues: string;
  };
  readonly nav: { readonly menu: string; readonly start: string; readonly faq: string };
}

export type PackageName = 'core' | 'angular' | 'analog' | 'astro' | 'tooling' | 'cli';

const en: SiteCopy = {
  seo: {
    description:
      'Etyma is a typed i18n toolkit for Angular, AnalogJS and Astro: MessageFormat 2, localized URLs, translated SSR and hydration without a flash of the wrong language.',
  },
  hero: {
    getStarted: 'Get started',
    copy: 'Copy',
    copied: 'Copied',
    demoLabel: 'Live preview',
    demoHint: 'Real MessageFormat 2, formatted by @etyma/core in this page.',
    countLabel: 'New messages',
    matched: 'Matched variant',
    source: 'inbox.mf2',
    rendered: 'Rendered',
    userName: 'Ada',
  },
  stack: { title: 'Built for the stack you already ship' },
  compare: {
    eyebrow: 'The difference',
    title: 'i18n bugs belong in your editor, not in production.',
    body: 'Most i18n layers fail quietly at runtime. Etyma moves each of those failures to a place where somebody sees it first.',
    before: 'Without Etyma',
    after: 'With Etyma',
    rows: [
      {
        before: 'A typo in a key ships as a blank label.',
        after: 'Unknown keys are TypeScript errors, in code and in Angular templates.',
      },
      {
        before: 'The page flashes English while the locale loads.',
        after: 'SSR transfers the active catalog, so hydration never fetches it again.',
      },
      {
        before: 'Plurals glued together with string concatenation.',
        after: 'MessageFormat 2 plurals that follow the rules of each language.',
      },
      {
        before: 'Hand-written hreflang tags drift away from the routes.',
        after: 'lang, dir, canonical and hreflang follow every navigation.',
      },
      {
        before: 'Catalog drift is reported by your users.',
        after: 'etyma validate fails CI before the drift reaches main.',
      },
    ],
  },
  features: {
    mf2Title: 'MessageFormat 2 built in',
    mf2Body:
      'Plurals, selects, numbers, dates and currencies with the Unicode standard, not a homegrown syntax.',
    routesTitle: 'Localized URLs',
    routesBody:
      '/docs, /es/docs, /uk/docs. The URL decides the language, so links, crawlers and caches agree.',
    remoteTitle: 'Bundled or remote catalogs',
    remoteBody:
      'Import JSON, lazy-load it or fetch it over HTTP. A generated contract keeps remote catalogs typed.',
    signalsTitle: 'Signals, zoneless',
    signalsBody: 'locale(), direction() and ready() are signals. No Zone.js, no subscriptions.',
  },
  start: {
    eyebrow: 'Quick start',
    title: 'From install to translated SSR in three steps.',
    body: 'Pick your framework. The core is the same everywhere; only the adapter changes.',
    install: 'Install',
    define: 'Define',
    use: 'Use',
    docs: 'Read the full guide',
  },
  packages: {
    npm: 'View on npm',
    descriptions: {
      core: 'Catalogs, MessageFormat 2, typed keys and params. No framework required.',
      angular: 'Signal-native injectI18n() and t() in templates. Zoneless by design.',
      analog: 'Localized file routes, locale loading before SSR and a localized head.',
      astro: 'Localized pages and server-rendered messages for Astro 6 and 7.',
      tooling: 'Vite plugins that generate contracts and validate catalogs at build time.',
      cli: 'etyma validate, contract and analyze, made to run in CI.',
    },
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions teams ask before switching.',
    items: [
      {
        question: 'Does Etyma need SSR?',
        answer:
          'No. @etyma/angular works in any Angular application. Localized routes, server rendering and the SEO head come from @etyma/analog when you want them.',
      },
      {
        question: 'Which versions are supported?',
        answer:
          'Angular 21 and 22, AnalogJS 2 and Astro 6 and 7. Every combination is checked in CI against the published package output.',
      },
      {
        question: 'Can translators work outside the repository?',
        answer:
          'Yes. Catalogs can be served from any HTTP endpoint. This site loads its own from a remote service and still type-checks every key through a generated contract.',
      },
      {
        question: 'Is MessageFormat 2 ready for production?',
        answer:
          'Etyma builds on the Unicode MessageFormat 2 reference implementation. The stable functions are always available; draft ones such as :date and :unit are on by default and can be turned off.',
      },
      {
        question: 'Is it open source?',
        answer:
          'Yes. Etyma is MIT licensed and developed in the open on GitHub. Issues and pull requests are welcome.',
      },
    ],
  },
  footer: {
    product: 'Product',
    project: 'Project',
    languages: 'Languages',
    releases: 'Releases',
    license: 'MIT license',
    issues: 'Issues',
  },
  nav: { menu: 'Menu', start: 'Quick start', faq: 'FAQ' },
};

const es: SiteCopy = {
  seo: {
    description:
      'Etyma es un toolkit de i18n tipado para Angular, AnalogJS y Astro: MessageFormat 2, URLs localizadas, SSR traducido e hidratación sin parpadeos de idioma.',
  },
  hero: {
    getStarted: 'Empezar',
    copy: 'Copiar',
    copied: 'Copiado',
    demoLabel: 'Vista previa en vivo',
    demoHint: 'MessageFormat 2 real, formateado por @etyma/core en esta página.',
    countLabel: 'Mensajes nuevos',
    matched: 'Variante elegida',
    source: 'inbox.mf2',
    rendered: 'Resultado',
    userName: 'Ada',
  },
  stack: { title: 'Pensado para el stack que ya usas' },
  compare: {
    eyebrow: 'La diferencia',
    title: 'Los errores de i18n se ven en el editor, no en producción.',
    body: 'La mayoría de capas i18n fallan en silencio en runtime. Etyma lleva cada uno de esos fallos a un sitio donde alguien lo ve antes.',
    before: 'Sin Etyma',
    after: 'Con Etyma',
    rows: [
      {
        before: 'Una errata en una clave llega a producción como una etiqueta vacía.',
        after:
          'Las claves desconocidas son errores de TypeScript, en código y en plantillas Angular.',
      },
      {
        before: 'La página muestra inglés mientras carga el idioma.',
        after: 'SSR transfiere el catálogo activo y la hidratación no lo vuelve a pedir.',
      },
      {
        before: 'Plurales construidos concatenando strings.',
        after: 'Plurales MessageFormat 2 que siguen las reglas de cada idioma.',
      },
      {
        before: 'Etiquetas hreflang escritas a mano que se desincronizan de las rutas.',
        after: 'lang, dir, canonical y hreflang siguen cada navegación.',
      },
      {
        before: 'Los usuarios descubren que faltan traducciones.',
        after: 'etyma validate rompe la CI antes de que el desajuste llegue a main.',
      },
    ],
  },
  features: {
    mf2Title: 'MessageFormat 2 integrado',
    mf2Body:
      'Plurales, selects, números, fechas y monedas con el estándar Unicode, no con una sintaxis inventada.',
    routesTitle: 'URLs localizadas',
    routesBody:
      '/docs, /es/docs, /uk/docs. La URL decide el idioma, así enlaces, buscadores y cachés coinciden.',
    remoteTitle: 'Catálogos locales o remotos',
    remoteBody:
      'Importa JSON, cárgalo de forma lazy o pídelo por HTTP. Un contrato generado mantiene tipados los catálogos remotos.',
    signalsTitle: 'Signals, sin Zone.js',
    signalsBody: 'locale(), direction() y ready() son signals. Sin Zone.js y sin suscripciones.',
  },
  start: {
    eyebrow: 'Inicio rápido',
    title: 'De la instalación al SSR traducido en tres pasos.',
    body: 'Elige tu framework. El core es el mismo en todos; solo cambia el adaptador.',
    install: 'Instalar',
    define: 'Definir',
    use: 'Usar',
    docs: 'Leer la guía completa',
  },
  packages: {
    npm: 'Ver en npm',
    descriptions: {
      core: 'Catálogos, MessageFormat 2, claves y parámetros tipados. Sin framework.',
      angular: 'injectI18n() basado en signals y t() en plantillas. Zoneless por diseño.',
      analog: 'Rutas de archivo localizadas, idioma cargado antes del SSR y head localizado.',
      astro: 'Páginas localizadas y mensajes renderizados en servidor para Astro 6 y 7.',
      tooling: 'Plugins de Vite que generan contratos y validan catálogos al compilar.',
      cli: 'etyma validate, contract y analyze, pensados para la CI.',
    },
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Lo que preguntan los equipos antes de cambiar.',
    items: [
      {
        question: '¿Etyma necesita SSR?',
        answer:
          'No. @etyma/angular funciona en cualquier aplicación Angular. Las rutas localizadas, el renderizado en servidor y el head SEO los aporta @etyma/analog cuando los quieras.',
      },
      {
        question: '¿Qué versiones están soportadas?',
        answer:
          'Angular 21 y 22, AnalogJS 2 y Astro 6 y 7. Cada combinación se comprueba en CI contra el paquete publicado.',
      },
      {
        question: '¿Pueden los traductores trabajar fuera del repositorio?',
        answer:
          'Sí. Los catálogos pueden servirse desde cualquier endpoint HTTP. Esta web carga los suyos desde un servicio remoto y aun así comprueba cada clave con un contrato generado.',
      },
      {
        question: '¿MessageFormat 2 está listo para producción?',
        answer:
          'Etyma usa la implementación de referencia de Unicode MessageFormat 2. Las funciones estables siempre están disponibles; las draft, como :date y :unit, están activadas por defecto y se pueden desactivar.',
      },
      {
        question: '¿Es open source?',
        answer:
          'Sí. Etyma tiene licencia MIT y se desarrolla en abierto en GitHub. Issues y pull requests son bienvenidos.',
      },
    ],
  },
  footer: {
    product: 'Producto',
    project: 'Proyecto',
    languages: 'Idiomas',
    releases: 'Versiones',
    license: 'Licencia MIT',
    issues: 'Issues',
  },
  nav: { menu: 'Menú', start: 'Inicio rápido', faq: 'FAQ' },
};

const uk: SiteCopy = {
  seo: {
    description:
      'Etyma — типізований i18n-тулкіт для Angular, AnalogJS і Astro: MessageFormat 2, локалізовані URL, перекладений SSR і гідратація без мерехтіння мови.',
  },
  hero: {
    getStarted: 'Почати',
    copy: 'Копіювати',
    copied: 'Скопійовано',
    demoLabel: 'Живий перегляд',
    demoHint: 'Справжній MessageFormat 2, відформатований @etyma/core на цій сторінці.',
    countLabel: 'Нові повідомлення',
    matched: 'Обраний варіант',
    source: 'inbox.mf2',
    rendered: 'Результат',
    userName: 'Ада',
  },
  stack: { title: 'Створено для стеку, який ви вже використовуєте' },
  compare: {
    eyebrow: 'Різниця',
    title: 'Помилкам i18n місце в редакторі, а не в продакшені.',
    body: 'Більшість i18n-рішень ламаються тихо, під час виконання. Etyma переносить кожну таку помилку туди, де її хтось побачить першим.',
    before: 'Без Etyma',
    after: 'З Etyma',
    rows: [
      {
        before: 'Друкарська помилка в ключі потрапляє в продакшен як порожній підпис.',
        after: 'Невідомі ключі — це помилки TypeScript, у коді та в шаблонах Angular.',
      },
      {
        before: 'Сторінка блимає англійською, поки вантажиться мова.',
        after: 'SSR передає активний каталог, тож гідратація не завантажує його вдруге.',
      },
      {
        before: 'Множина, склеєна конкатенацією рядків.',
        after: 'Множина MessageFormat 2 за правилами кожної мови.',
      },
      {
        before: 'Написані вручну hreflang розходяться з маршрутами.',
        after: 'lang, dir, canonical і hreflang оновлюються з кожною навігацією.',
      },
      {
        before: 'Про розбіжності в каталогах повідомляють користувачі.',
        after: 'etyma validate зупиняє CI, перш ніж розбіжність потрапить у main.',
      },
    ],
  },
  features: {
    mf2Title: 'Вбудований MessageFormat 2',
    mf2Body:
      'Множина, select, числа, дати й валюти за стандартом Unicode, а не за вигаданим синтаксисом.',
    routesTitle: 'Локалізовані URL',
    routesBody:
      '/docs, /es/docs, /uk/docs. Мову визначає URL, тож посилання, пошуковики й кеші узгоджені.',
    remoteTitle: 'Локальні або віддалені каталоги',
    remoteBody:
      'Імпортуйте JSON, вантажте його ліниво або отримуйте через HTTP. Згенерований контракт зберігає типи віддалених каталогів.',
    signalsTitle: 'Signals, без Zone.js',
    signalsBody: 'locale(), direction() і ready() — це signals. Без Zone.js і без підписок.',
  },
  start: {
    eyebrow: 'Швидкий старт',
    title: 'Від встановлення до перекладеного SSR за три кроки.',
    body: 'Оберіть фреймворк. Ядро однакове скрізь, змінюється лише адаптер.',
    install: 'Встановити',
    define: 'Визначити',
    use: 'Використати',
    docs: 'Читати повний посібник',
  },
  packages: {
    npm: 'Відкрити в npm',
    descriptions: {
      core: 'Каталоги, MessageFormat 2, типізовані ключі й параметри. Без фреймворку.',
      angular: 'injectI18n() на signals і t() у шаблонах. Zoneless за задумом.',
      analog: 'Локалізовані файлові маршрути, мова до SSR і локалізований head.',
      astro: 'Локалізовані сторінки й серверні повідомлення для Astro 6 і 7.',
      tooling: 'Vite-плагіни, що генерують контракти й перевіряють каталоги під час збірки.',
      cli: 'etyma validate, contract і analyze для CI.',
    },
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Що питають команди перед переходом.',
    items: [
      {
        question: 'Чи потрібен Etyma SSR?',
        answer:
          'Ні. @etyma/angular працює в будь-якому Angular-застосунку. Локалізовані маршрути, серверний рендеринг і SEO-head додає @etyma/analog, коли вони потрібні.',
      },
      {
        question: 'Які версії підтримуються?',
        answer:
          'Angular 21 і 22, AnalogJS 2 та Astro 6 і 7. Кожну комбінацію перевіряє CI на опублікованих пакетах.',
      },
      {
        question: 'Чи можуть перекладачі працювати поза репозиторієм?',
        answer:
          'Так. Каталоги можна віддавати з будь-якого HTTP-ендпоінта. Цей сайт завантажує свої з віддаленого сервісу й однаково перевіряє кожен ключ через згенерований контракт.',
      },
      {
        question: 'Чи готовий MessageFormat 2 до продакшену?',
        answer:
          'Etyma використовує еталонну реалізацію Unicode MessageFormat 2. Стабільні функції доступні завжди; чернеткові, як-от :date і :unit, увімкнені за замовчуванням і їх можна вимкнути.',
      },
      {
        question: 'Це open source?',
        answer:
          'Так. Etyma має ліцензію MIT і розробляється відкрито на GitHub. Issues і pull requests вітаються.',
      },
    ],
  },
  footer: {
    product: 'Продукт',
    project: 'Проєкт',
    languages: 'Мови',
    releases: 'Релізи',
    license: 'Ліцензія MIT',
    issues: 'Issues',
  },
  nav: { menu: 'Меню', start: 'Швидкий старт', faq: 'FAQ' },
};

export const SITE_COPY = { en, es, uk } as const satisfies Readonly<Record<string, SiteCopy>>;

export function siteCopy(locale: Locale): SiteCopy {
  const copies: Readonly<Record<string, SiteCopy | undefined>> = SITE_COPY;

  return copies[locale] ?? SITE_COPY.en;
}
