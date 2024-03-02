// TODO ZOD?

export type CertificateConfig = {
    pemLocation: string,
    keyLocation: string,
    certificateAuthorityLocation?: string,
}

export type HttpsConfig = {
    skipCertificateValidation?: boolean,
    cert?: CertificateConfig
}

export type ServerHostConfig = {
    hostName?: string
    subdomain?: string
}

export type ClientConfig = {

    localHost: URL,
    server?: ServerHostConfig,
    https?: HttpsConfig
}

export type TunnelConfig = Required<Omit<ClientConfig, 'https'>> & {

    server: Required<ServerHostConfig>,
    https?: HttpsConfig
}

const defaultConfig = (): Omit<TunnelConfig, 'localHost'> => ({
    server: {
        hostName: 'localtunnel.me',
        subdomain: undefined
    },
    https: undefined
})
export const applyConfig = (config: ClientConfig): TunnelConfig => {
    // TODO Validate config
    
    return Object.assign({}, defaultConfig(), JSON.parse(JSON.stringify(config)), { localHost: config.localHost })
}