import { io, type Socket } from 'socket.io-client'
import { apiFetch } from './api'
import { getSocketUrl } from './socket-url'

export function connectTableSocket(): Socket {
  return io(getSocketUrl(), {
    auth: async (callback) => {
      try {
        const { token } = await apiFetch<{ token: string }>('/auth/socket-token')
        callback({ token })
      } catch {
        callback({ token: '' })
      }
    },
  })
}
