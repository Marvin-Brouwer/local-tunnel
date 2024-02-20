import { Transform } from 'node:stream'

type TODO = any;

export class HeaderHostTransformer extends Transform {

  #host: TODO;
  #replaced: boolean;

  constructor(opts: Partial<TODO> = {}) {
    super(opts);
    this.#host = opts.host || 'localhost';
    this.#replaced = false;
  }

  protected transform(data: TODO, encoding: TODO, callback: TODO) {
    callback(
      null,
      this.#replaced // after replacing the first instance of the Host header we just become a regular passthrough
        ? data
        : data.toString().replace(/(\r\n[Hh]ost: )\S+/, (match, $1) => {
            this.#replaced = true;
            return $1 + this.#host;
          })
    );
  }
}

module.exports = HeaderHostTransformer;
