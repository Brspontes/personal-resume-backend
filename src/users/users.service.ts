import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { LinkedinIdentity } from '../linkedin/linkedin-identity.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromLinkedin(identity: LinkedinIdentity): Promise<User> {
    return this.prisma.user.upsert({
      where: { linkedinId: identity.sub },
      update: {
        name: identity.name,
        avatarUrl: identity.picture,
        email: identity.email,
      },
      create: {
        linkedinId: identity.sub,
        name: identity.name,
        avatarUrl: identity.picture,
        email: identity.email,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
