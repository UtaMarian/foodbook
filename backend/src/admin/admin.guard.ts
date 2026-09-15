import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';

/**
 * Verificam rolul direct din DB (nu din JWT): endpoint-urile admin sunt
 * putine si rare, iar asa un admin retrogradat pierde accesul imediat,
 * nu abia dupa expirarea access token-ului (15 min).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as RequestUser | undefined;
    if (!user) throw new ForbiddenException('Acces interzis');

    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (row?.role !== 'ADMIN') throw new ForbiddenException('Acces interzis');

    return true;
  }
}
