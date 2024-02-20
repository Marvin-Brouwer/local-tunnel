// TODO ZOD?

const randomDomain = Symbol.for('?new');

type CertificateConfig = {
    pemLocation: string,
    keyLocation: string,
    certificateAuthorityLocation?: string,
}

type HttpsConfig = {
    skipCertificateValidation?: boolean,
    cert?: CertificateConfig
}

type ServerHostConfig = {
    hostName?: string
    subDomain?: string | typeof randomDomain
}

export type ClientConfig = {

    port: number
    hostName?: string
    // TODO retryPolicy

    server?: ServerHostConfig,
    https?: HttpsConfig
}

export type TunnelConfig = Required<Omit<ClientConfig, 'https'>> & {

    server: Required<ServerHostConfig>,
    https?: HttpsConfig
}

const defaultConfig = (port: number): TunnelConfig => ({
    port,
    hostName: 'localhost',
    server: {
        hostName: 'localtunnel.me',
        subDomain: randomDomain
    },
    https: undefined
})
export const applyConfig = (config: ClientConfig): TunnelConfig => {
    // TODO Validate config
    
    return Object.assign(defaultConfig(config.port), config)
}