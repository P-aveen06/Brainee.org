"use client";

import { Calendar, ChevronDown, Home } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeaveRequestSheet } from "./LeaveRequestSheet";
import { WfhRequestSheet } from "./WfhRequestSheet";

export function RequestActions() {
	const [leaveOpen, setLeaveOpen] = useState(false);
	const [wfhOpen, setWfhOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button type="button" className="gap-1.5">
							Apply
							<ChevronDown className="size-3.5" aria-hidden="true" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem
						onClick={() => setLeaveOpen(true)}
						className="gap-2 cursor-pointer"
					>
						<Calendar className="size-4 text-muted-foreground" />
						<span>Apply for Leave</span>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => setWfhOpen(true)}
						className="gap-2 cursor-pointer"
					>
						<Home className="size-4 text-muted-foreground" />
						<span>Apply for WFH</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<LeaveRequestSheet open={leaveOpen} onOpenChange={setLeaveOpen} />
			<WfhRequestSheet open={wfhOpen} onOpenChange={setWfhOpen} />
		</>
	);
}
