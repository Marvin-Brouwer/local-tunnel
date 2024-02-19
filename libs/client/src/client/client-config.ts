// TODO type to exclude already used functions

type CertificateConfig = {
    pemLocation: string,
    keyLocation: string,
    certificateAuthorityLocation: string,
}
type HttpsConfig = {
    skipCertificateValidation?: boolean,
    cert?: CertificateConfig
}

export type ClientConfig<TSelf extends ClientConfig = ClientConfig<any>> = {
    withCustomHost(url: URL | string): TSelf;
    withHttps(config: HttpsConfig): TSelf
    withDomain(name: string, errorIfNotAvailable: false): TSelf
}