const Doctor = require("../model/doctor_model");
const DoctorAvailability = require("../model/doctor_availability_model");
const Appointment = require("../model/appointment_model");
const DoctorTimeOff = require("../model/doctor_time_off_model");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

function toIntDate(d) {
  return +new Date(d);
}

async function getWeeklyAvailability({ doctorId, startISO, days = 7, tzOverride }) {
  const span = Math.min(Math.max(Number(days) || 7, 1), 14);

  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) throw new Error("Doctor not found");

  const tz = tzOverride || doctor.timeZone || "UTC";
  // Parse the ISO string - if it contains timezone info, parse with timezone, otherwise assume UTC
  let startLocal;
  try {
    // Try parsing with timezone first
    if (startISO.includes('+') || startISO.includes('-') && startISO.match(/-\d{2}:\d{2}$/)) {
      startLocal = dayjs(startISO).tz(tz).startOf("day");
    } else {
      // No timezone, parse as UTC then convert
      startLocal = dayjs.utc(startISO).tz(tz).startOf("day");
    }
  } catch (e) {
    // Fallback: parse as UTC
    startLocal = dayjs.utc(startISO).tz(tz).startOf("day");
  }
  const endLocal = startLocal.add(span, "day");
  
  console.log(`[AvailabilityService] Doctor ${doctorId}: tz=${tz}, startISO=${startISO}, startLocal=${startLocal.format("YYYY-MM-DD")}, dayOfWeek=${startLocal.day()}`);

  const startUtc = startLocal.utc().toDate();
  const endUtc = endLocal.utc().toDate();

  const [rules, appts, timeOffs] = await Promise.all([
    DoctorAvailability.find({ doctor: doctorId }).lean(),
    Appointment.find({
      doctor: doctorId,
      status: { $in: ["pending", "confirmed"] },
      startTime: { $gte: startUtc, $lt: endUtc },
    }).lean(),
    DoctorTimeOff.find({
      doctor: doctorId,
      start: { $lt: endUtc },
      end: { $gt: startUtc },
    }).lean(),
  ]);

  const taken = new Set(appts.map((a) => +a.startTime));
  const blocks = timeOffs.map((x) => ({
    startLocal: dayjs(x.start).tz(tz),
    endLocal: dayjs(x.end).tz(tz),
  }));

  const nowLocal = dayjs().tz(tz);
  const out = {
    doctorId: String(doctorId),
    tz,
    weekStart: startLocal.format("YYYY-MM-DD"),
    days: [],
  };

  for (let d = 0; d < span; d++) {
    const day = startLocal.add(d, "day");
    const dow = day.day();
    const dayRules = rules.filter((r) => r.dayOfWeek === dow);
    const slots = [];

    for (const r of dayRules) {
      const step = r.slotDurationMinutes || 15;
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      let cursor = day.hour(sh).minute(sm).second(0).millisecond(0);
      const hardEnd = day.hour(eh).minute(em).second(0).millisecond(0);

      while (cursor.isBefore(hardEnd)) {
        const next = cursor.add(step, "minute");
        const blocked = blocks.some(
          (b) => cursor.isBefore(b.endLocal) && next.isAfter(b.startLocal)
        );
        const startUtcDate = cursor.utc().toDate();
        const booked = taken.has(toIntDate(startUtcDate));
        const past = cursor.isBefore(nowLocal);
        const available = !blocked && !booked && !past;

        slots.push({
          startLocal: cursor.format(),
          startUtc: startUtcDate.toISOString(),
          label: cursor.format("hh:mm A"),
          available,
          durationMinutes: step,
        });

        cursor = next;
      }
    }

    out.days.push({ date: day.format("YYYY-MM-DD"), slots });
  }

  return out;
}

module.exports = { getWeeklyAvailability };
