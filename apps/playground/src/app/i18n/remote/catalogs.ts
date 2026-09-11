/**
 * Stands in for a remote catalog service, for a fixture that must run offline and
 * deterministically in CI - see `remote-i18n.ts` for why this isn't a real HTTP endpoint.
 *
 * The source locale is included here like every other locale: this is exactly the "no local
 * source catalog at all" scenario `defineRemoteI18n` exists for.
 */
export const remoteCatalogs = {
  en: {
    nav: { docs: 'Remote docs' },
    remote: {
      title: 'Remote catalog demo',
      lede: 'Every message here, including English, is loaded asynchronously - none of it is in this bundle.',
      active: 'Active locale: {$locale}',
    },
  },
  es: {
    nav: { docs: 'Documentos remotos' },
    remote: {
      title: 'Demostración de catálogo remoto',
      lede: 'Cada mensaje aquí, incluido el inglés, se carga de forma asíncrona: nada de esto está en este paquete.',
      active: 'Idioma activo: {$locale}',
    },
  },
  uk: {
    nav: { docs: 'Віддалена документація' },
    remote: {
      title: 'Демонстрація віддаленого каталогу',
      lede: 'Кожне повідомлення тут, включно з англійською, завантажується асинхронно - нічого з цього немає у збірці.',
      active: 'Активна мова: {$locale}',
    },
  },
} as const;

export type RemoteLocale = keyof typeof remoteCatalogs;
