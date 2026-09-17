import { inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { participantSafetyData } from '../db/schema';
import { decryptIdentity } from './booking-security';
import { getDepartureOperations } from './departure-operations';

const decrypt = (value: string | null) =>
  value ? decryptIdentity(value) : null;

export async function getEmergencyManifest(departureId: string) {
  const operations = await getDepartureOperations(departureId);
  if (!operations) return null;
  const participantIds = operations.manifest.map((person) => person.id);
  const db = getDb();
  const safetyRows = participantIds.length
    ? await db
        .select({
          participantId: participantSafetyData.bookingParticipantId,
          address: participantSafetyData.addressCiphertext,
          emergencyName: participantSafetyData.emergencyNameCiphertext,
          emergencyRelationship:
            participantSafetyData.emergencyRelationshipCiphertext,
          emergencyWhatsApp: participantSafetyData.emergencyWhatsAppCiphertext,
          identityType: participantSafetyData.identityType,
          identityNumber: participantSafetyData.identityCiphertext,
          status: participantSafetyData.status,
          reviewedAt: participantSafetyData.reviewedAt,
        })
        .from(participantSafetyData)
        .where(
          inArray(participantSafetyData.bookingParticipantId, participantIds),
        )
    : [];
  const safetyByParticipant = new Map(
    safetyRows.map((row) => [row.participantId, row]),
  );
  return {
    schedule: operations.schedule,
    generatedAt: new Date(),
    participants: operations.manifest.map((person) => {
      const safety = safetyByParticipant.get(person.id);
      return {
        ...person,
        safety: safety
          ? {
              address: decrypt(safety.address),
              emergencyName: decrypt(safety.emergencyName),
              emergencyRelationship: decrypt(safety.emergencyRelationship),
              emergencyWhatsApp: decrypt(safety.emergencyWhatsApp),
              identityType: safety.identityType,
              identityNumber: decrypt(safety.identityNumber),
              status: safety.status,
              reviewedAt: safety.reviewedAt,
            }
          : null,
      };
    }),
  };
}
