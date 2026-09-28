import { Badge } from "@/components/ui/badge";
import { CheckIcon } from "@/components/ui/icons";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { PermissionInfo, RoleDefinition } from "@/lib/auth/roles";
import { TONE_CLASSES } from "@/lib/ui/tones";

/**
 * What each role may do, as the roles tab shows it: one row per role, one
 * column per permission. Read-only here; the ticks are edited in the sheet.
 */
export function RoleMatrix<P extends string>({
  roles,
  catalogue,
}: {
  roles: RoleDefinition<P>[];
  catalogue: PermissionInfo<P>[];
}) {
  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Role</Th>
            {catalogue.map((permission) => (
              <Th key={permission.key} title={permission.description} className="text-center normal-case tracking-normal">
                {permission.label}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {roles.map((role) => (
            <Tr key={role.name}>
              <Td className="min-w-48">
                <p className="font-medium text-slate-900">
                  {role.name}
                  {role.blocks ? (
                    <Badge tone="neutral" className="ml-2" title="Choosing this on the Users tab keeps the person out of this app. It can never be given permissions.">
                      Blocks access
                    </Badge>
                  ) : null}
                  {role.locked ? (
                    <Badge tone="info" className="ml-2" title="Administrator always has every permission, so it can never be locked out.">
                      Always everything
                    </Badge>
                  ) : null}
                </p>
                {role.description ? <p className="text-xs text-slate-500">{role.description}</p> : null}
              </Td>
              {catalogue.map((permission) => {
                const allowed = role.locked || role.permissions.includes(permission.key);
                return (
                  <Td key={permission.key} className="text-center">
                    {allowed ? (
                      <CheckIcon className={`mx-auto size-4 ${TONE_CLASSES.success.text}`} aria-label="Allowed" />
                    ) : (
                      <span className="text-slate-300" aria-label="Not allowed">
                        —
                      </span>
                    )}
                  </Td>
                );
              })}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}
