generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model ExampleEntity {
  id        BigInt   @id @default(autoincrement()) @db.UnsignedBigInt
  title     String   @db.VarChar(120)
  createdAt DateTime @default(now()) @db.DateTime(0)
}
