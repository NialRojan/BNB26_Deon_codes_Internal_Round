const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const documents = await prisma.claimDocument.count();
  const owners = await prisma.owner.count();
  const recoveries = await prisma.recoveryAttempt.count();
  const heartbeats = await prisma.heartbeatEvent.count();

  console.log({
    documents,
    owners,
    recoveries,
    heartbeats,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
