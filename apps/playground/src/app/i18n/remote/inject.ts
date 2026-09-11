import { injectI18n, type EtymaI18n } from '@etyma/angular';

import { remoteI18n, type RemoteMessageId } from './remote-i18n.js';

/** The typed handle on the remote-mode demo's own, isolated i18n instance. */
export const injectRemoteI18n = (): EtymaI18n<RemoteMessageId> => injectI18n(remoteI18n);
