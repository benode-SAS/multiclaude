import { customAlphabet } from 'nanoid'

export const newId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 14)
export const now = () => Date.now()
