"use client";

import {
  CLASS_WEEKDAYS,
  groupMeetingsForDisplay,
  validateMeetingBlocks,
  type ClassMeetingBlock,
  type ClassWeekday,
} from "@/lib/class-meetings";

export type ScheduleEditorBlock = ClassMeetingBlock & {
  key: string;
};

type ClassScheduleEditorProps = {
  meetings: ScheduleEditorBlock[];
  onChange: (meetings: ScheduleEditorBlock[]) => void;
  showErrors: boolean;
};

const selectableWeekdays = CLASS_WEEKDAYS.slice(0, 6);
const weekdayLabels: Record<ClassWeekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

function newBlock(index: number): ScheduleEditorBlock {
  return {
    key: `meeting-${Date.now()}-${index}`,
    weekdays: [],
    start_time: "",
    end_time: "",
  };
}

export default function ClassScheduleEditor({
  meetings,
  onChange,
  showErrors,
}: ClassScheduleEditorProps) {
  const validation = validateMeetingBlocks(meetings);
  const previewGroups = groupMeetingsForDisplay(validation.meetings);

  function updateBlock(index: number, update: Partial<ScheduleEditorBlock>) {
    onChange(
      meetings.map((meeting, meetingIndex) =>
        meetingIndex === index ? { ...meeting, ...update } : meeting
      )
    );
  }

  function toggleWeekday(index: number, weekday: ClassWeekday) {
    const block = meetings[index];
    const weekdays = block.weekdays.includes(weekday)
      ? block.weekdays.filter((day) => day !== weekday)
      : [...block.weekdays, weekday];
    updateBlock(index, { weekdays });
  }

  return (
    <div className="space-y-5">
      <input
        type="hidden"
        name="meetings"
        value={JSON.stringify(
          meetings.map(({ weekdays, start_time, end_time }) => ({
            weekdays,
            start_time,
            end_time,
          }))
        )}
      />

      <div className="space-y-4">
        {meetings.map((meeting, index) => {
          const errors = showErrors ? validation.blockErrors[index] : undefined;
          const daysErrorId = `meeting-${index}-days-error`;
          const startErrorId = `meeting-${index}-start-error`;
          const endErrorId = `meeting-${index}-end-error`;
          const blockErrorId = `meeting-${index}-block-error`;

          return (
            <fieldset
              key={meeting.key}
              tabIndex={-1}
              data-schedule-block={index}
              data-schedule-error={errors && Object.keys(errors).length ? "true" : undefined}
              className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 outline-none focus-visible:ring-2 focus-visible:ring-gray-400 sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <legend className="text-sm font-semibold text-gray-900">
                  Meeting {index + 1}
                </legend>
                {meetings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(meetings.filter((_, meetingIndex) => meetingIndex !== index))}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 active:translate-y-px"
                    aria-label={`Remove meeting ${index + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-4">
                <span className="block text-sm font-medium text-gray-700">Days</span>
                <div
                  className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6"
                  role="group"
                  aria-label={`Weekdays for meeting ${index + 1}`}
                  aria-describedby={errors?.weekdays ? daysErrorId : undefined}
                >
                  {selectableWeekdays.map((weekday) => {
                    const selected = meeting.weekdays.includes(weekday);
                    return (
                      <button
                        key={weekday}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleWeekday(index, weekday)}
                        className={`rounded-lg border px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 active:translate-y-px ${
                          selected
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                        }`}
                      >
                        {weekdayLabels[weekday]}
                      </button>
                    );
                  })}
                </div>
                {errors?.weekdays && (
                  <p id={daysErrorId} className="mt-2 text-xs font-medium text-red-700">
                    {errors.weekdays}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`meeting-${index}-start`} className="block text-sm font-medium text-gray-700">
                    Start Time
                  </label>
                  <input
                    id={`meeting-${index}-start`}
                    type="time"
                    value={meeting.start_time}
                    onChange={(event) => updateBlock(index, { start_time: event.target.value })}
                    aria-invalid={Boolean(errors?.start_time)}
                    aria-describedby={errors?.start_time ? startErrorId : undefined}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  />
                  {errors?.start_time && (
                    <p id={startErrorId} className="mt-2 text-xs font-medium text-red-700">
                      {errors.start_time}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`meeting-${index}-end`} className="block text-sm font-medium text-gray-700">
                    End Time
                  </label>
                  <input
                    id={`meeting-${index}-end`}
                    type="time"
                    value={meeting.end_time}
                    onChange={(event) => updateBlock(index, { end_time: event.target.value })}
                    aria-invalid={Boolean(errors?.end_time)}
                    aria-describedby={errors?.end_time ? endErrorId : undefined}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  />
                  {errors?.end_time && (
                    <p id={endErrorId} className="mt-2 text-xs font-medium text-red-700">
                      {errors.end_time}
                    </p>
                  )}
                </div>
              </div>

              {errors?.block && (
                <p id={blockErrorId} className="mt-3 text-xs font-medium text-red-700" role="alert">
                  {errors.block}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange([...meetings, newBlock(meetings.length + 1)])}
        className="inline-flex w-full items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 active:translate-y-px sm:w-auto"
      >
        + Add Meeting Block
      </button>

      <section className="rounded-xl border border-gray-200 bg-white p-4" aria-labelledby="schedule-preview-heading">
        <h3 id="schedule-preview-heading" className="text-sm font-semibold text-gray-900">
          Schedule Preview
        </h3>
        {previewGroups.length ? (
          <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
            {previewGroups.map((group) => (
              <li key={`${group.weekdays.join("-")}-${group.start_time}-${group.end_time}`}>
                {group.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            Select days and enter a valid time range to preview the schedule.
          </p>
        )}
      </section>
    </div>
  );
}
