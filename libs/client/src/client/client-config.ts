// TODO ZOD?

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
    subdomain?: string
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
        subdomain: undefined
    },
    https: undefined
})
export const applyConfig = (config: ClientConfig): TunnelConfig => {
    // TODO Validate config
    
    return Object.assign({}, defaultConfig(config.port), JSON.parse(JSON.stringify(config)))
}