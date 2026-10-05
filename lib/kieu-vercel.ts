// lib/kieu-vercel.ts
//
// Vercel truyen vao ham xu ly hai doi tuong: req va res.
// Chung la doi tuong HTTP chuan cua Node, duoc Vercel them vai tien ich.
//
// Goi @vercel/node co dinh nghia san hai kieu nay, nhung no keo ve 112 goi
// kem 11 canh bao bao mat - toan bo la cong cu build, khong chay trong
// san pham. Nen ta tu khai bao. Khong them phu thuoc nao.

import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & {
  /** Tham so sau dau ? trong URL. Vi du ?address=0x... -> query.address */
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type VercelResponse = ServerResponse & {
  status(ma: number): VercelResponse;
  json(noiDung: unknown): VercelResponse;
  send(noiDung: unknown): VercelResponse;
};
