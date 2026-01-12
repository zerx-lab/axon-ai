import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import type { QuestionRequest, QuestionAnswer } from "@/types/chat";

interface QuestionPromptProps {
  request: QuestionRequest;
  onReply: (answers: QuestionAnswer[]) => void;
  onReject: () => void;
}

export function QuestionPrompt({ request, onReply, onReject }: QuestionPromptProps) {
  const { t } = useTranslation();
  const { questions } = request;
  const [activeTab, setActiveTab] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswer[]>(
    questions.map(() => [])
  );
  const [customInputs, setCustomInputs] = useState<string[]>(
    questions.map(() => "")
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  const currentQuestion = questions[activeTab];
  const isLastQuestion = activeTab === questions.length - 1;
  const isSingleQuestion = questions.length === 1;
  const isConfirmTab = !isSingleQuestion && activeTab === questions.length;
  const isMultiple = currentQuestion?.multiple === true;
  const currentAnswer = answers[activeTab] || [];
  const customInput = customInputs[activeTab] || "";

  const options = currentQuestion?.options || [];
  const allOptions = [
    ...options,
    { label: t("questionPrompt.otherCustom"), description: t("questionPrompt.enterYourAnswer") },
  ];

  const isCustomAnswered = customInput.length > 0 && currentAnswer.includes(customInput);

  const handleSelectOption = useCallback(
    (index: number) => {
      if (isConfirmTab) return;

      const option = options[index];
      if (!option) return;

      if (isMultiple) {
        const newAnswers = [...answers];
        const current = newAnswers[activeTab] || [];
        const labelIndex = current.indexOf(option.label);

        if (labelIndex >= 0) {
          current.splice(labelIndex, 1);
        } else {
          current.push(option.label);
        }
        newAnswers[activeTab] = current;
        setAnswers(newAnswers);
      } else {
        const newAnswers = [...answers];
        newAnswers[activeTab] = [option.label];
        setAnswers(newAnswers);

        if (isSingleQuestion) {
          onReply([[option.label]]);
        } else if (isLastQuestion) {
          setActiveTab(questions.length);
        } else {
          setActiveTab(activeTab + 1);
        }
      }
    },
    [
      activeTab,
      answers,
      isConfirmTab,
      isLastQuestion,
      isMultiple,
      isSingleQuestion,
      onReply,
      options,
      questions.length,
    ]
  );

  const handleCustomSubmit = useCallback(() => {
    if (!customInput.trim()) {
      setIsEditingCustom(false);
      return;
    }

    const newAnswers = [...answers];
    const newInputs = [...customInputs];

    if (isMultiple) {
      const current = newAnswers[activeTab] || [];
      const oldCustom = customInputs[activeTab];

      if (oldCustom) {
        const oldIndex = current.indexOf(oldCustom);
        if (oldIndex >= 0) {
          current.splice(oldIndex, 1);
        }
      }

      if (!current.includes(customInput)) {
        current.push(customInput);
      }
      newAnswers[activeTab] = current;
    } else {
      newAnswers[activeTab] = [customInput];
    }

    newInputs[activeTab] = customInput;
    setAnswers(newAnswers);
    setCustomInputs(newInputs);
    setIsEditingCustom(false);

    if (!isMultiple) {
      if (isSingleQuestion) {
        onReply([[customInput]]);
      } else if (isLastQuestion) {
        setActiveTab(questions.length);
      } else {
        setActiveTab(activeTab + 1);
      }
    }
  }, [
    activeTab,
    answers,
    customInput,
    customInputs,
    isLastQuestion,
    isMultiple,
    isSingleQuestion,
    onReply,
    questions.length,
  ]);

  const handleConfirm = useCallback(() => {
    onReply(answers);
  }, [answers, onReply]);

  const allQuestionsAnswered = questions.every((_, i) => (answers[i]?.length || 0) > 0);

  return (
    <div className="rounded-md border border-amber-500/50 bg-card animate-in fade-in slide-in-from-bottom-2 duration-200">
      {!isSingleQuestion && (
        <div className="flex items-center gap-1 border-b border-border/50 px-3 py-2 bg-muted/30">
          {questions.map((q, i) => {
            const isActive = i === activeTab;
            const isAnswered = (answers[i]?.length || 0) > 0;
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-colors duration-150",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {q.header}
                {isAnswered && !isActive && (
                  <span className="ml-1 text-green-500">✓</span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setActiveTab(questions.length)}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors duration-150",
              isConfirmTab
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            {t("questionPrompt.confirm")}
          </button>
        </div>
      )}

      <div className="p-3 space-y-3">
        {!isConfirmTab && currentQuestion && (
          <>
            <div className="text-sm font-medium">
              {currentQuestion.question}
              {isMultiple && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {t("questionPrompt.multipleSelection")}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {allOptions.map((opt, i) => {
                const isSelected = i === selectedIndex;
                const isChecked = currentAnswer.includes(opt.label);
                const isCustomOption = i === options.length;
                const showCustomInput = isCustomOption && isEditingCustom;

                return (
                  <div key={i}>
                    <button
                      onClick={() => {
                        setSelectedIndex(i);
                        if (isCustomOption) {
                          setIsEditingCustom(true);
                        } else {
                          handleSelectOption(i);
                        }
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150",
                        isSelected
                          ? "bg-accent"
                          : "hover:bg-accent/50",
                        isChecked && "border-l-2 border-green-500"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-medium",
                                isChecked && "text-green-600 dark:text-green-400"
                              )}
                            >
                              {opt.label}
                            </span>
                            {isChecked && (
                              <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {opt.description}
                          </div>
                        </div>
                      </div>
                    </button>

                    {showCustomInput && (
                      <div className="mt-1.5 ml-3 space-y-2">
                        <Input
                          autoFocus
                          value={customInput}
                          onChange={(e) => {
                            const newInputs = [...customInputs];
                            newInputs[activeTab] = e.target.value;
                            setCustomInputs(newInputs);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCustomSubmit();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setIsEditingCustom(false);
                            }
                          }}
                          placeholder={t("questionPrompt.enterAnswer")}
                          className="text-sm"
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">
                            Enter
                          </kbd>
                          <span>{t("questionPrompt.submit")}</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border ml-2">
                            Esc
                          </kbd>
                          <span>{t("questionPrompt.cancel")}</span>
                        </div>
                      </div>
                    )}

                    {isCustomOption && !showCustomInput && customInput && (
                      <div className="mt-1 ml-3 text-xs text-muted-foreground">
                        {t("questionPrompt.currentInput")} {customInput}
                        {isCustomAnswered && (
                          <Check className="inline h-3 w-3 ml-1 text-green-500" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {isConfirmTab && (
          <div className="space-y-3">
            <div className="text-sm font-medium">{t("questionPrompt.confirmAnswers")}</div>
            <div className="space-y-2">
              {questions.map((q, i) => {
                const answer = answers[i] || [];
                const hasAnswer = answer.length > 0;
                return (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">
                      {q.header}:
                    </span>
                    <span
                      className={cn(
                        "font-medium",
                        hasAnswer ? "text-foreground" : "text-destructive"
                      )}
                    >
                      {hasAnswer ? answer.join(", ") : t("questionPrompt.notAnswered")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/50 bg-muted/20">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {!isConfirmTab && (
            <span>
              {isMultiple ? t("questionPrompt.clickToToggle") : t("questionPrompt.clickToSelect")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={onReject}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {t("questionPrompt.cancel")}
          </Button>

          {isConfirmTab && (
            <Button
              variant="default"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={handleConfirm}
              disabled={!allQuestionsAnswered}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {t("questionPrompt.submitAnswers")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
