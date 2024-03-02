import zod from 'zod';

const certificateConfig = zod
	.object({
		pemLocation: zod.string().trim(),
		keyLocation: zod.string().trim(),
		certificateAuthorityLocation: zod.string().trim().optional(),
	});
export interface CertificateConfig extends zod.infer<typeof certificateConfig> { }

const httpsConfig = zod
	.object({
		skipCertificateValidation: zod.boolean().default(false).optional(),
		cert: (certificateConfig as zod.ZodType<CertificateConfig>).optional(),
	});
export interface HttpsConfig extends zod.infer<typeof httpsConfig> {}

const serverConfig = zod
	.object({
		hostName: zod.string().trim().optional(),
		subdomain: zod.string().trim().optional(),
	});
export interface ServerHostConfig extends zod.infer<typeof serverConfig> {}

const clientConfig = zod
	.object({
		localHost: zod.instanceof(URL), // todo no path etc.
		server: (serverConfig as zod.ZodType<ServerHostConfig>).default({ hostName: 'localtunnel.me' }).optional(),
		https: (httpsConfig as zod.ZodType<HttpsConfig>).default({ }).optional(),
	});
export interface ClientConfig extends zod.infer<typeof clientConfig> { }

export type TunnelConfig = Required<Omit<ClientConfig, 'https'>> & {

    server: Required<ServerHostConfig>,
    https?: HttpsConfig
}

export const applyConfig = (config: ClientConfig) => clientConfig.parse(config) as TunnelConfig;
