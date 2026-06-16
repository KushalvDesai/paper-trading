import prisma from './src/db';
import bcrypt from 'bcryptjs';

async function main() {
  const hashedPassword = await bcrypt.hash('password', 10);
  
  let admin = await prisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        wallet: 100000
      }
    });
    console.log('Created default admin user');
  }

  const updatedPositions = await prisma.position.updateMany({
    where: { userId: '' }, // Just a placeholder, actually we already ran this script so we can just comment it out
    data: { userId: admin.id }
  });

  console.log(`Linked ${updatedPositions.count} existing positions to admin user`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
