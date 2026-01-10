import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const SECRET_KEY = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'dev-secret')

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production')
}

export type Session = {
  userId: number
  role: string
  name: string
  iat?: number
  exp?: number
}

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string) {
  return await bcrypt.compare(password, hash)
}

export function signToken(payload: Omit<Session, 'iat' | 'exp'>) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: '8h' })
}

export function verifyToken(token: string): Session | null {
  try {
    const decoded = jwt.verify(token, SECRET_KEY)
    if (typeof decoded !== 'object' || decoded === null) return null
    const maybe = decoded as Partial<Session>
    if (typeof maybe.userId !== 'number') return null
    if (typeof maybe.role !== 'string') return null
    if (typeof maybe.name !== 'string') return null
    return maybe as Session
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}
