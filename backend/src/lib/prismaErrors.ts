import { Prisma } from "@prisma/client";

/** true si l'erreur est une violation de contrainte unique portant sur ce champ précis. */
export function isUniqueConstraintViolation(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    ((error.meta?.target as string[] | undefined)?.includes(field) ?? false)
  );
}
