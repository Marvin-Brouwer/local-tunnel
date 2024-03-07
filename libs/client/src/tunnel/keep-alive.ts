import { type TunnelLease } from './tunnel-lease';
import packageConfig from '../../package.json';
import { createLogger } from '../logger';

const logger = createLogger('localtunnel:keep-alive');

export const keepAlive = async (tunnelLease: TunnelLease, abortSignal: AbortSignal) => {
	// This seems to be necessary to prevent the tunnel from closing, event though keepalive is set to true
	const intervalHandle = setInterval(() => {
		if (abortSignal.aborted) return;

		fetch(`${tunnelLease.tunnelUrl}?keepalive`, {
			method: 'OPTIONS',
			signal: abortSignal,
			keepalive: false,
			mode: 'cors',
			headers: {
				'Bypass-Tunnel-Reminder': tunnelLease.id,
				'User-Agent': encodeURIComponent(`${packageConfig.name}@${packageConfig.version}`)
			}
		})
			.catch((e) => {
				// don't care about any error.
				if (logger.enabled) logger.log('Keepalive error %j', e);
			});
	}, 2000);

	abortSignal.addEventListener('abort', () => {
		clearInterval(intervalHandle);
	});
};
