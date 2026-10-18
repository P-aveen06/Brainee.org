import { useAuiState } from "@assistant-ui/react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import type { PitchPackage } from "@/lib/ai/pitch-types";
import type { MessageCustomData } from "./AssistantRuntimeAdapter";
import { PitchCanvas } from "./PitchCanvas";

const PitchContext = createContext<(pitch: PitchPackage) => void>(() => {});
export const useOpenPitch = () => useContext(PitchContext);

export function PitchWorkspace({ children }: { children: ReactNode }) {
	const [selected, setSelected] = useState<PitchPackage | null>(null);
	const messages = useAuiState((state) => state.thread.messages);
	useEffect(() => {
		if (!selected) return;
		const newer = messages
			.flatMap(
				(message) =>
					(message.metadata?.custom as Partial<MessageCustomData>)?.pitches ??
					[],
			)
			.filter(
				(pitch) =>
					pitch.draftId === selected.draftId &&
					pitch.revision > selected.revision,
			)
			.sort((a, b) => b.revision - a.revision)[0];
		if (newer) setSelected(newer);
	}, [messages, selected]);
	return (
		<PitchContext value={setSelected}>
			<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
				<div
					className={`flex min-h-0 min-w-0 flex-1 flex-col ${selected ? "max-lg:hidden lg:max-w-[40%]" : ""}`}
				>
					{children}
				</div>
				{selected && (
					<PitchCanvas
						key={selected.draftId}
						pitch={selected}
						onClose={() => setSelected(null)}
					/>
				)}
			</div>
		</PitchContext>
	);
}
