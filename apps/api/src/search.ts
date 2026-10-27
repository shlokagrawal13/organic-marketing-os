import { Controller, Get, Module, Query, Req, UseGuards } from "@nestjs/common";
import { AuthedRequest, Db, TenantGuard, parse } from "./common";

import {
  workspaceSearchQuery,
  workspaceSearchSql,
  type SearchRow,
} from "./search-query";

@Controller("workspaces/:organizationId/search")
@UseGuards(TenantGuard)
export class SearchController {
  constructor(private db: Db) {}
  @Get() async search(@Req() req: AuthedRequest, @Query() query: unknown) {
    const input = parse(workspaceSearchQuery, query);
    const rows = await this.db.$queryRaw<SearchRow[]>(
      workspaceSearchSql(req.organizationId, input),
    );
    const more = rows.length > input.take;
    return {
      items: rows.slice(0, input.take),
      nextSkip:
        more && input.skip + input.take <= 1000
          ? input.skip + input.take
          : null,
      truncated: more && input.skip + input.take > 1000,
    };
  }
}
@Module({ controllers: [SearchController], providers: [TenantGuard] })
export class SearchModule {}
