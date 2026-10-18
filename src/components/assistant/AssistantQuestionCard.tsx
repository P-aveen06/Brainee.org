"use client";

import {
	ArrowRight,
	CircleHelp,
	Mic,
	MicOff,
	PencilLine,
	X,
} from "lucide-react";
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import type { AssistantQuestionSet } from "@/lib/ai/assistant-questions";

interface AssistantQuestionCardProps {
	questionSet: AssistantQuestionSet;
	answered: boolean;
	onSubmit: (answers: string) => void;
}

interface QuestionAnswer {
	optionIds: string[];
	text: string;
}

export function AssistantQuestionCard({
	questionSet,
	answered,
	onSubmit,
}: AssistantQuestionCardProps) {
	const headingId = useId();
	const [questionIndex, setQuestionIndex] = useState(0);
	const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
	const [skipped, setSkipped] = useState<string[]>([]);
	const [submitted, setSubmitted] = useState(false);
	const [dismissed, setDismissed] = useState(false);
	const question = questionSet.questions[questionIndex];
	const isResolved = answered || submitted;
	const answer = answers[question?.id] || { optionIds: [], text: "" };
	const activeQuestionCount = questionSet.questions.length;
	const isLastQuestion = questionIndex === activeQuestionCount - 1;
	const answerText = answer.text.trim();
	const hasAnswer =
		answerText.length > 0 ||
		answer.optionIds.length > 0 ||
		skipped.includes(question?.id);

	const handleVoiceTranscript = useCallback(
		(text: string) => {
			setAnswers((current) => ({
				...current,
				[questionSet.questions[questionIndex].id]: { optionIds: [], text },
			}));
		},
		[questionIndex, questionSet.questions],
	);
	const { isListening, isSupported, toggleListening } = useSpeechToText({
		onTranscriptChange: handleVoiceTranscript,
	});

	if (!question || dismissed) return null;

	const selectedOptions = question.options?.filter((option) =>
		answer.optionIds.includes(option.id),
	);
	const currentAnswer =
		answerText || selectedOptions?.map((option) => option.label).join(", ");

	const submitAnswers = (skippedQuestions = skipped) => {
		if (isResolved) return;
		setSubmitted(true);
		onSubmit(
			`Answers to the follow-up questions:\n${questionSet.questions
				.map((item) => {
					if (skippedQuestions.includes(item.id)) {
						return `- ${item.prompt}: (skipped)`;
					}
					const itemAnswer = answers[item.id] || { optionIds: [], text: "" };
					const text = itemAnswer.text.trim();
					const labels = item.options
						?.filter((option) => itemAnswer.optionIds.includes(option.id))
						.map((option) => option.label);
					return `- ${item.prompt}: ${text || labels?.join(", ") || "(skipped)"}`;
				})
				.join("\n")}`,
		);
	};

	const skipQuestion = () => {
		const skippedQuestions = skipped.includes(question.id)
			? skipped
			: [...skipped, question.id];
		setSkipped(skippedQuestions);
		if (isLastQuestion) {
			submitAnswers(skippedQuestions);
		} else {
			setQuestionIndex((current) => current + 1);
		}
	};

	const advance = () => {
		if (!hasAnswer || isResolved) return;
		if (isLastQuestion) {
			submitAnswers();
		} else {
			setQuestionIndex((current) => current + 1);
		}
	};

	const selectOption = (optionId: string) => {
		setSkipped((current) => current.filter((id) => id !== question.id));
		setAnswers((current) => {
			const previous = current[question.id] || { optionIds: [], text: "" };
			const selected = previous.optionIds.includes(optionId);
			const optionIds =
				question.type === "single_choice"
					? [optionId]
					: selected
						? previous.optionIds.filter((id) => id !== optionId)
						: [...previous.optionIds, optionId];
			return { ...current, [question.id]: { optionIds, text: "" } };
		});
	};

	const setFreeformAnswer = (text: string) => {
		setSkipped((current) => current.filter((id) => id !== question.id));
		setAnswers((current) => ({
			...current,
			[question.id]: { optionIds: [], text },
		}));
	};

	return (
		<section
			aria-labelledby={headingId}
			className="my-3 max-w-3xl rounded-3xl border border-border bg-card px-5 py-4 shadow-xs sm:px-6"
		>
			<div className="mb-4 flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3 text-muted-foreground">
					<CircleHelp className="size-5 shrink-0" aria-hidden="true" />
					<h3 id={headingId} className="text-base font-medium">
						Question
					</h3>
					{activeQuestionCount > 1 && (
						<span className="text-sm">
							{questionIndex + 1} of {activeQuestionCount}
						</span>
					)}
				</div>
				{isResolved ? (
					<output aria-live="polite" className="text-sm text-muted-foreground">
						Answers sent
					</output>
				) : (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Dismiss question"
						title="Dismiss question"
						onClick={() => setDismissed(true)}
						className="text-muted-foreground"
					>
						<X className="size-5" />
					</Button>
				)}
			</div>

			<fieldset disabled={isResolved} className="min-w-0">
				<legend className="mb-4 text-lg font-medium leading-7 text-foreground sm:text-xl">
					{question.prompt}
				</legend>
				{question.options && (
					<div className="space-y-1.5">
						{question.options.map((option, index) => {
							const selected = answer.optionIds.includes(option.id);
							return (
								<Button
									key={option.id}
									type="button"
									variant="ghost"
									aria-pressed={selected}
									onClick={() => selectOption(option.id)}
									className={`min-h-12 w-full justify-between gap-3 px-3 text-left text-base font-normal whitespace-normal ${selected ? "bg-surface-alt" : "hover:bg-surface-alt"}`}
								>
									<span className="flex min-w-0 items-center gap-3">
										<span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-sm text-muted-foreground">
											{index + 1}
										</span>
										<span className="min-w-0">
											<span className="block">{option.label}</span>
											{option.description && (
												<span className="block text-sm text-muted-foreground">
													{option.description}
												</span>
											)}
										</span>
									</span>
									<ArrowRight className="size-5 shrink-0 text-muted-foreground" />
								</Button>
							);
						})}
					</div>
				)}

				{question.suggestedAnswer && (
					<div className="mb-3 rounded-xl border border-border/70 bg-surface-alt/50 p-3">
						<div className="mb-1 flex items-center justify-between gap-3">
							<p className="text-sm font-medium">Suggested answer</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() =>
									setFreeformAnswer(question.suggestedAnswer ?? "")
								}
							>
								{answerText ? "Replace with suggestion" : "Use suggestion"}
							</Button>
						</div>
						<p className="text-sm text-muted-foreground">
							{question.suggestedAnswer}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Draft from available project context. Review and edit before
							sending.
						</p>
					</div>
				)}

				<div className="mt-4 flex min-w-0 items-start gap-2 border-b border-border/70 pb-2">
					<PencilLine
						className="mt-2 size-5 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
					<Textarea
						aria-label={`Your response to: ${question.prompt}`}
						value={answer.text}
						onChange={(event) => setFreeformAnswer(event.target.value)}
						rows={2}
						placeholder={
							question.options
								? "Or write your own response"
								: "Write your response"
						}
						className="min-h-16 min-w-0 flex-1 resize-y border-0 bg-transparent px-1 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
					/>
					{isSupported && (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={isListening ? "Stop dictation" : "Dictate response"}
							title={isListening ? "Stop dictation" : "Dictate response"}
							onClick={toggleListening}
						>
							{isListening ? (
								<MicOff className="size-5" />
							) : (
								<Mic className="size-5" />
							)}
						</Button>
					)}
				</div>
			</fieldset>

			{!isResolved && (
				<div className="mt-4 flex items-center justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={skipQuestion}
						className="h-10 px-4"
					>
						Skip
					</Button>
					<Button
						type="button"
						disabled={!hasAnswer}
						onClick={advance}
						className="h-10 bg-neutral-900 px-5 font-extrabold text-white hover:bg-neutral-800"
					>
						{isLastQuestion ? "Send" : "Next"}
					</Button>
				</div>
			)}
			{isResolved && currentAnswer && (
				<p className="mt-3 text-sm text-muted-foreground">{currentAnswer}</p>
			)}
		</section>
	);
}
