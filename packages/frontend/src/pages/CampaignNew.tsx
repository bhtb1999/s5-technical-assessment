import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createCampaign } from "../api/campaigns";
import { createRecipient, getRecipients } from "../api/recipients";
import type { Recipient } from "../types";

interface FormErrors {
  name?: string;
  subject?: string;
  body?: string;
  recipients?: string;
  general?: string;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function CampaignNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<FormErrors>({});

  const [quickEmail, setQuickEmail] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);

  const [search, setSearch] = useState("");

  const { data: recipientsData, isLoading: loadingRecipients } = useQuery({
    queryKey: ["recipients", search],
    queryFn: () => getRecipients({ limit: 100, search: search || undefined }),
  });

  const recipients: Recipient[] = recipientsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      navigate(`/campaigns/${campaign.id}`);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setErrors({
        general: message ?? "Failed to create campaign. Please try again.",
      });
    },
  });

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "Campaign name is required.";
    if (!subject.trim()) errs.subject = "Subject line is required.";
    if (!body.trim()) errs.body = "Email body is required.";
    if (selectedIds.size === 0)
      errs.recipients = "Select at least one recipient.";
    return errs;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    createMutation.mutate({
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      recipientIds: Array.from(selectedIds),
    });
  }

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (errors.recipients) setErrors((e) => ({ ...e, recipients: undefined }));
  }

  function toggleSelectAll() {
    if (selectedIds.size === recipients.length && recipients.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recipients.map((r) => r.id)));
    }
  }

  async function handleQuickAdd() {
    setQuickError("");
    if (!quickEmail.trim()) {
      setQuickError("Email is required.");
      return;
    }
    if (!validateEmail(quickEmail.trim())) {
      setQuickError("Please enter a valid email address.");
      return;
    }
    if (!quickName.trim()) {
      setQuickError("Name is required.");
      return;
    }

    setQuickLoading(true);
    try {
      const newRecipient = await createRecipient({
        email: quickEmail.trim(),
        name: quickName.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["recipients"] });
      setSelectedIds((prev) => new Set([...prev, newRecipient.id]));
      setQuickEmail("");
      setQuickName("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setQuickError(msg ?? "Failed to add recipient.");
    } finally {
      setQuickLoading(false);
    }
  }

  const allSelected =
    recipients.length > 0 && selectedIds.size === recipients.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < recipients.length;
  const isSubmitting = createMutation.isPending;

  return (
    <div className="page-container max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/campaigns"
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Back to campaigns"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-gray-900">New Campaign</h1>
      </div>

      {errors.general && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Basic info card */}
        <div className="card p-6 space-y-4">
          <h2 className="text-gray-900 text-base">Campaign Details</h2>

          <div>
            <label className="label" htmlFor="camp-name">
              Campaign Name
            </label>
            <input
              id="camp-name"
              type="text"
              className={`input ${errors.name ? "input-error" : ""}`}
              placeholder="e.g. Summer Sale Announcement"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>

          <div>
            <label className="label" htmlFor="camp-subject">
              Email Subject
            </label>
            <input
              id="camp-subject"
              type="text"
              className={`input ${errors.subject ? "input-error" : ""}`}
              placeholder="e.g. Don't miss our biggest sale of the year!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSubmitting}
            />
            {errors.subject && <p className="error-text">{errors.subject}</p>}
          </div>

          <div>
            <label className="label" htmlFor="camp-body">
              Email Body
            </label>
            <textarea
              id="camp-body"
              rows={8}
              className={`input resize-y ${errors.body ? "input-error" : ""}`}
              placeholder="Write your email content here…"
              value={body}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setBody(e.target.value)
              }
              disabled={isSubmitting}
            />
            {errors.body && <p className="error-text">{errors.body}</p>}
          </div>
        </div>

        {/* Recipients card */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-gray-900 text-base">
              Recipients
              {selectedIds.size > 0 && (
                <span className="ml-2 text-sm font-normal text-primary-600">
                  ({selectedIds.size} selected)
                </span>
              )}
            </h2>
          </div>

          {errors.recipients && (
            <p className="text-sm text-red-600 -mt-1">{errors.recipients}</p>
          )}

          {/* Quick-add form */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-dashed border-gray-300">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Quick Add Recipient
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                className="input text-sm"
                placeholder="Name"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                disabled={quickLoading}
              />
              <input
                type="email"
                className="input text-sm"
                placeholder="Email address"
                value={quickEmail}
                onChange={(e) => setQuickEmail(e.target.value)}
                disabled={quickLoading}
              />
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={handleQuickAdd}
                disabled={quickLoading}
              >
                {quickLoading ? (
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                )}
                Add
              </button>
            </div>
            {quickError && <p className="text-xs text-red-600">{quickError}</p>}
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="search"
              className="input pl-9 text-sm"
              placeholder="Search recipients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Recipient list */}
          {loadingRecipients ? (
            <div className="flex items-center justify-center py-8">
              <svg
                className="w-6 h-6 animate-spin text-primary-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              {search
                ? "No recipients match your search."
                : "No recipients yet. Add one above."}
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Select all header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <input
                  id="select-all"
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleSelectAll}
                />
                <label
                  htmlFor="select-all"
                  className="text-xs font-medium text-gray-600 cursor-pointer select-none"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </label>
                <span className="ml-auto text-xs text-gray-400">
                  {recipients.length} recipient
                  {recipients.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* List */}
              <div className="max-h-64 overflow-y-auto scrollbar-thin divide-y divide-gray-100">
                {recipients.map((recipient) => {
                  const checked = selectedIds.has(recipient.id);
                  return (
                    <label
                      key={recipient.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary-50 transition-colors ${
                        checked ? "bg-primary-50" : "bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={checked}
                        onChange={() => toggleRecipient(recipient.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {recipient.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {recipient.email}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pb-4">
          <Link to="/campaigns" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Creating…
              </>
            ) : (
              "Create Campaign"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
