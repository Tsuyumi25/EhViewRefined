export const listViews = ['m', 'p', 'l', 'e', 't'] as const

export type ListView = (typeof listViews)[number]
export type NativeView = Exclude<ListView, 'e'>
