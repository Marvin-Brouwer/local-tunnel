import { TunnelConfig } from '../client/client-config';

export type TunnelLease = {

    id: string,

    tunnelUrl: URL,
    cachedTunnelUrl: URL | undefined,

    client: {
        publicIp: string | undefined
    },

    remote: {
        ip: string | undefined,
        target: string,
        port: number
    },

    httpsEnabled: boolean
    maximumConnections: number
}

type TunnelLeaseResponse = {
    id: string, 
    ip: string, 
    port: number, 
    url: string, 
    cached_url: string, 
    max_conn_count: number | undefined
}

const getLeaseUrl = (config: TunnelConfig): string => {
    
    const { subDomain } = config.server;
    const assignedDomain = subDomain.constructor === Symbol
      ? subDomain.description
      : subDomain as string
      
    return `${config.hostName}/${assignedDomain}`;
}

export const getTunnelLease = async (config: TunnelConfig): Promise<TunnelLease>  => {
    
    const url = getLeaseUrl(config);
    const leaseFetchResponse = await fetch(url);
    // TODO specific error(s)
    if (!leaseFetchResponse.ok) 
        throw new Error(leaseFetchResponse.statusText)

    // TODO ZOD
    const leaseResponse = await leaseFetchResponse.json() as TunnelLeaseResponse
    const clientIp = await fetch('api.ipify.org')
        .then(response => response.text())
        .catch(err =>  {
            console.warn('Unable to determine tunnel password', err);
            return undefined;
        })

    return createTunnelLease(config, leaseResponse, clientIp);
}

const createTunnelLease = (config: TunnelConfig, leaseResponse: TunnelLeaseResponse, clientIp: string | undefined): TunnelLease  => ({
    id: leaseResponse.id,

    tunnelUrl: new URL(leaseResponse.url),
    cachedTunnelUrl: leaseResponse.cached_url && new URL(leaseResponse.cached_url),

    client: {
        publicIp: clientIp
    },
    
    remote: {
        ip: leaseResponse.ip,
        // Prefer the ip if returned from the server
        target: leaseResponse.ip ?? config.server.hostName,
        port: leaseResponse.port
    },

    httpsEnabled: !!config.https,
    maximumConnections: leaseResponse.max_conn_count || 1
})