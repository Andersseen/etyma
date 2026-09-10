import type { MessageSource } from '@etyma/core';

/**
 * A small catalog shaped like Volt UI's real documentation site catalog — not the 700+ key
 * original, but the same mix of plain strings, an external variable, a number format and a
 * plural, nested the same way real docs content is. Used to prove the validator handles a
 * realistic nested documentation catalog, not just single-message unit cases.
 */
export const voltEn: MessageSource = {
  nav: {
    docs: 'Docs',
    components: 'Components',
  },
  docs: {
    theme: {
      title: 'Theming',
    },
  },
  footer: {
    rights: '© {$year :number useGrouping=never} Volt UI',
  },
  components: {
    dialog: {
      description:
        'A window overlaid on the primary window, rendering the content underneath inert.',
    },
    button: {
      count:
        '.input {$count :number}\n' +
        '.match $count\n' +
        'one {{{$count} button variant is documented.}}\n' +
        '*   {{{$count} button variants are documented.}}',
    },
  },
};

export const voltEs: MessageSource = {
  nav: {
    docs: 'Documentación',
    components: 'Componentes',
  },
  docs: {
    theme: {
      title: 'Temas',
    },
  },
  footer: {
    rights: '© {$year :number useGrouping=never} Volt UI',
  },
  components: {
    dialog: {
      description: 'Una ventana superpuesta a la ventana principal que inertiza lo que cubre.',
    },
    button: {
      count:
        '.input {$count :number}\n' +
        '.match $count\n' +
        'one {{Se documenta {$count} variante de botón.}}\n' +
        '*   {{Se documentan {$count} variantes de botón.}}',
    },
  },
};

/**
 * Ukrainian genuinely needs `one` / `few` / `many` / `other` — a fourth plural category
 * English and Spanish do not have. The validator must accept this difference rather than
 * requiring every locale to share the same branch labels as the source.
 */
export const voltUk: MessageSource = {
  nav: {
    docs: 'Документація',
    components: 'Компоненти',
  },
  docs: {
    theme: {
      title: 'Теми',
    },
  },
  footer: {
    rights: '© {$year :number useGrouping=never} Volt UI',
  },
  components: {
    dialog: {
      description: 'Вікно, накладене на головне вікно, робить вміст під ним неактивним.',
    },
    button: {
      count:
        '.input {$count :number}\n' +
        '.match $count\n' +
        'one {{Задокументовано {$count} варіант кнопки.}}\n' +
        'few {{Задокументовано {$count} варіанти кнопки.}}\n' +
        'many {{Задокументовано {$count} варіантів кнопки.}}\n' +
        '*    {{Задокументовано {$count} варіанта кнопки.}}',
    },
  },
};
