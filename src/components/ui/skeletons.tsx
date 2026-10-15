import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatGroup } from "@/components/ui/stat-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

const range = (n: number) => Array.from({ length: n }, (_, i) => `sk-${i}`);

export function StatGroupSkeleton({ count = 4 }: { count?: number }) {
	return (
		<StatGroup>
			{range(count).map((i) => (
				<div key={i} className="flex items-center gap-2.5 px-3 py-2 sm:px-3.5">
					<Skeleton className="size-8 rounded-lg" />
					<div className="space-y-1.5">
						<Skeleton className="h-6 w-14" />
						<Skeleton className="h-3 w-24" />
					</div>
				</div>
			))}
		</StatGroup>
	);
}

export function CardSkeleton({
	lines = 3,
	className,
}: {
	lines?: number;
	className?: string;
}) {
	return (
		<Card className={className}>
			<CardHeader>
				<Skeleton className="h-4 w-1/3" />
			</CardHeader>
			<CardContent className="space-y-2">
				{range(lines).map((id, i) => (
					<Skeleton
						key={id}
						className="h-3.5"
						style={{ width: `${90 - i * 12}%` }}
					/>
				))}
			</CardContent>
		</Card>
	);
}

export function TableSkeleton({
	rows = 6,
	columns = 5,
}: {
	rows?: number;
	columns?: number;
}) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					{range(columns).map((i) => (
						<TableHead key={i}>
							<Skeleton className="h-3 w-20" />
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{range(rows).map((rid, r) => (
					<TableRow key={rid}>
						{range(columns).map((cid, c) => (
							<TableCell key={cid}>
								<Skeleton
									className="h-4"
									style={{ width: `${55 + ((r + c) % 4) * 10}%` }}
								/>
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

/** Generic route fallback: header, stat row, and a couple of cards. */
export function PageSkeleton() {
	return (
		<output className="block space-y-4 sm:space-y-5" aria-label="Loading">
			<Skeleton className="h-6 w-56" />
			<StatGroupSkeleton />
			<div className="grid grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-2">
				<CardSkeleton lines={4} />
				<CardSkeleton lines={4} />
			</div>
		</output>
	);
}

export function DashboardSkeleton() {
	return (
		<output
			className="block space-y-4 sm:space-y-5"
			aria-label="Loading dashboard"
		>
			<Skeleton className="h-28 w-full rounded-xl" />
			<div className="grid items-stretch gap-3.5 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className="grid grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-6">
					<CardSkeleton lines={4} className="md:col-span-2" />
					<CardSkeleton lines={4} className="md:col-span-2" />
					<CardSkeleton lines={4} className="md:col-span-2" />
					<CardSkeleton lines={6} className="md:col-span-3" />
					<CardSkeleton lines={6} className="md:col-span-3" />
				</div>
				<Skeleton className="h-[460px] w-full rounded-xl" />
			</div>
		</output>
	);
}
