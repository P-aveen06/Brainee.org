// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistantQuestionCard } from "./AssistantQuestionCard";

describe("AssistantQuestionCard", () => {
	it("lets the user apply and edit a suggested answer", () => {
		const suggestion = "Reuse the current project access patterns.";
		render(
			<AssistantQuestionCard
				questionSet={{
					requestId: "request-1",
					questions: [
						{
							id: "scope",
							prompt: "What should this task include?",
							type: "text",
							suggestedAnswer: suggestion,
						},
					],
				}}
				answered={false}
				onSubmit={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Use suggestion" }));
		const response = screen.getByRole("textbox", {
			name: "Your response to: What should this task include?",
		}) as HTMLTextAreaElement;
		expect(response.value).toBe(suggestion);

		fireEvent.change(response, { target: { value: "My edited answer." } });
		expect(response.value).toBe("My edited answer.");
	});
});
