import "reflect-metadata";
import { NestFactory, APP_GUARD } from "@nestjs/core";
import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import {
  InfrastructureModule,
  Db,
  Cache,
  Public,
  AuthGuard,
  ApiErrors,
  installSecurity,
  origin,
} from "./common";
import { AuthModule } from "./auth";
import { OrganizationsModule } from "./organizations";
import { BrandModule } from "./brand";
import { AIModule } from "./ai";
import { ContentModule } from "./content";
import { AssetsModule } from "./assets";
import { RendersModule } from "./renders";
import { OperationsModule } from "./operations";
import { CreditsModule } from "./credits";
import { GeneratedMediaModule } from "./generated-media";
import { PublicationsModule } from "./publications";
import { SocialConnectionsModule } from "./social-connections";
import { creditPolicy } from "../../../packages/core/credits";
import { stripeBillingConfiguration } from "../../../packages/core/billing";

@Controller("health")
@Public()
class HealthController {
  constructor(
    private db: Db,
    private cache: Cache,
  ) {}
  @Get() async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      await this.cache.client.ping();
      return { status: "ok", database: "connected", redis: "connected" };
    } catch {
      throw new ServiceUnavailableException(
        "A required service is unavailable.",
      );
    }
  }
}
@Module({
  imports: [
    InfrastructureModule,
    AuthModule,
    OrganizationsModule,
    BrandModule,
    AIModule,
    ContentModule,
    AssetsModule,
    RendersModule,
    OperationsModule,
    CreditsModule,
    GeneratedMediaModule,
    PublicationsModule,
    SocialConnectionsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
async function main() {
  creditPolicy();
  stripeBillingConfiguration();
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.WEB_ORIGIN?.startsWith("https://") ||
      process.env.COOKIE_SECURE !== "true")
  )
    throw new Error(
      "Production requires an HTTPS WEB_ORIGIN and COOKIE_SECURE=true.",
    );
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
    bodyParser: true,
    rawBody: true,
  });
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 2)
    throw new Error("TRUST_PROXY_HOPS must be 0, 1 or 2.");
  if (proxyHops)
    app.getHttpAdapter().getInstance().set("trust proxy", proxyHops);
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: origin(),
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "X-Requested-With",
      "Idempotency-Key",
      "X-MOS-Billing-Timestamp",
      "X-MOS-Billing-Signature",
      "Stripe-Signature",
    ],
  });
  installSecurity(app, app.get(Cache));
  app.useGlobalFilters(new ApiErrors());
  await app.listen(Number(process.env.API_PORT || 4000), "0.0.0.0");
}
if (require.main === module)
  main().catch(() => {
    console.error(
      "API startup failed. Check configuration and service health.",
    );
    process.exit(1);
  });
