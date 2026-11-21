import type { Stream } from './Globals'
import { MessageNames, Socket } from './Socket'

export class PiMost {
  socketMost: unknown
  socketMostClient: { stream: (stream: Stream) => void }
  constructor(socket: Socket) {
    if (process.platform !== 'linux') throw Error('PiMost requires Linux')
    const { SocketMost, SocketMostClient } = require('socketmost')
    this.socketMost = new SocketMost()
    this.socketMostClient = new SocketMostClient()
    socket.on(MessageNames.Stream, (stream: Stream) => this.stream(stream))
  }
  stream(stream: Stream) { this.socketMostClient.stream(stream) }
}
