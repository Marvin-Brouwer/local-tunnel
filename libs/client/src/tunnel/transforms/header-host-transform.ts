import internal, { Transform } from 'node:stream'
import { TunnelConfig } from '../../client/client-config';

export class HeaderHostTransform extends Transform {

  #replaced: boolean;
  static #hostHeaderMatch = /(\r\n[Hh]ost: )\S+/;

  constructor(
    private readonly config: TunnelConfig
  ) {
    super();
    this.#replaced = false;
    this._transform.bind(this);
  }

  override _transform(this: HeaderHostTransform, chunk: Uint8Array | string, _encoding: BufferEncoding, callback: internal.TransformCallback): void {
    
    if (this.#replaced) {
      return callback(null, chunk);
    }

    // TODO, there has to be a more readable approach
    const replacedData = chunk
      .toString()
      .replace(HeaderHostTransform.#hostHeaderMatch, (_match, $1) => {
        return $1 + this.config.server.hostName;
      })

    this.#replaced = true;
    
    callback(null, replacedData);
  }
}