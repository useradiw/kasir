import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma";

export class ActionError extends Error {
  code: string;
  constructor(message: string, code = "ACTION_ERROR") {
    super(message);
    this.name = "ActionError";
    this.code = code;
  }
}

function firstZodMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Data tidak valid.";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

function prismaMessage(e: Prisma.PrismaClientKnownRequestError): string {
  switch (e.code) {
    case "P2002": {
      const target = (e.meta?.target as string[] | undefined)?.join(", ");
      return target ? `${target} sudah digunakan.` : "Data sudah ada.";
    }
    case "P2025":
      return "Data tidak ditemukan.";
    case "P2003":
      return "Data masih terhubung dengan catatan lain.";
    default:
      return "Kesalahan basis data.";
  }
}

export const actionError = {
  fromZod(error: ZodError): never {
    throw new ActionError(firstZodMessage(error), "VALIDATION");
  },
  fromPrisma(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      throw new ActionError(prismaMessage(e), e.code);
    }
    if (e instanceof ActionError) throw e;
    if (e instanceof Error) throw new ActionError(e.message);
    throw new ActionError("Terjadi kesalahan.");
  },
};

export async function runAction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ActionError) throw e;
    if (e instanceof ZodError) actionError.fromZod(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) actionError.fromPrisma(e);
    throw e;
  }
}
