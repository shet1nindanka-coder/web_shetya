import { HomeworkNumberStatus } from "@prisma/client";
import { Badge } from "@/components/badge";
import { homeworkStatusMeta } from "@/lib/utils";

type HomeworkStatusBadgeProps = {
  status: HomeworkNumberStatus | null;
};

export function HomeworkStatusBadge({ status }: HomeworkStatusBadgeProps) {
  if (!status) {
    return <Badge className="ui-badge-soft">Не отмечено</Badge>;
  }

  const meta = homeworkStatusMeta[status];

  return (
    <Badge className={meta.subtleClassName}>
      {meta.shortLabel}
    </Badge>
  );
}
