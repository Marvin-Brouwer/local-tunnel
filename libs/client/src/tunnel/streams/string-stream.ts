import { Duplex } from 'node:stream';

class PushStream extends Duplex {
    constructor() {
        super({
            allowHalfOpen: true,
            autoDestroy: false,
        });
    }

    _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error) => void): void {
        console.log(chunk.toString());
        callback();
    }
    _read(size: number): void {
        while(true) { };
    }
    
}

export const stringStream = () =>  new Duplex({
    read(size) {
      
        this.push([
          'HTTP/1.1 200 OK',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Encoding: UTF-8',
          'Accept-Ranges: bytes',
          'Connection: keep-alive',
        ].join('\n') + '\n\n');
      
        this.push(`
          <h1> Example </h1>
        `);
      
      this.push(null);
    //   if (this.currentCharCode > 90) {
    //     this.push(null);
    //   }
    },
    write(chunk, encoding, callback) {
      console.log(chunk.toString());
      callback();
    },
    autoDestroy: false,
    allowHalfOpen: true,

});