import zod, { type ZodType, object } from 'zod';

const optional = <T extends ZodType>(zodType: T) => zodType.optional().nullable();

const certificateConfig = zod
	.object({
		pemLocation: zod.string().trim(),
		keyLocation: zod.string().trim(),
		certificateAuthorityLocation: optional(zod.string().trim()),
	});
export interface CertificateConfig extends zod.infer<typeof certificateConfig> { }

const httpsConfig = zod
	.object({
		skipCertificateValidation: zod.boolean().default(false).optional(),
		cert: optional(certificateConfig as zod.ZodType<CertificateConfig>),
	});
export interface HttpsConfig extends zod.infer<typeof httpsConfig> {}

const serverConfig = zod
	.object({
		hostName: optional(zod.string().trim()),
		subdomain: optional(zod.string().trim()),
	});
export interface ServerHostConfig extends zod.infer<typeof serverConfig> {}

const literalError = (message: string) => ({
	errorMap: () => ({ message }),
});
const originUrlSchema = object({
	port: optional(zod.coerce.number()),
	pathname: zod.literal('/', literalError('Value contains a path, this is not supported.'))
		// Only allow single value
		.refine((v) => (v === '/' ? zod.OK : zod.INVALID)),
	search: zod.literal('', literalError('Value contains a query, this is not supported.')),
	hash: zod.literal('', literalError('Value contains a hash, this is not supported.')),
});

const urlSchema = zod
	.string()
	.url({ message: 'Invalid URL representation presented. ' })
	.pipe(zod.string().transform((value) => new URL(value)));

export const parseUrl = (url: string) => {
	const urlResult = urlSchema.safeParse(url);
	if (!urlResult.success) return urlResult;

	const originUrlResult = originUrlSchema
		.safeParse(urlResult.data);
	if (!originUrlResult.success) return originUrlResult as unknown as typeof urlResult;

	return urlResult;
};

const clientConfig = zod
	.object({
		localHost: zod.instanceof(URL).refine((url) => originUrlSchema.parse(url)),
		server: optional((serverConfig as zod.ZodType<ServerHostConfig>).default({ hostName: 'localtunnel.me' })),
		https: optional((httpsConfig as zod.ZodType<HttpsConfig>).default({ })),
	});
export interface ClientConfig extends zod.infer<typeof clientConfig> { }

export type TunnelConfig = Required<Omit<ClientConfig, 'https'>> & {

	server: ServerHostConfig,
	https?: HttpsConfig
}

export const applyConfig = (config: ClientConfig) => clientConfig.parse(config) as TunnelConfig;
