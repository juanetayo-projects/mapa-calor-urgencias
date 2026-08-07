-- Sync query: extrae registros del rango @StartDate → @EndDate
-- Parámetros pasados como NVarChar desde el script Node.js
-- SUPUESTO: dateStartTriage almacenado en hora local Colombia (UTC-5)

SET DATEFIRST 1;

SELECT
     uctd.code                                                AS 'TipoIdentificacion'
    ,ehrt.documentNumber                                      AS 'Documento'
    ,CONCAT_WS(' ', ehrt.givenName, ehrt.familyName)         AS 'Nombre'
    ,CAST(DATEDIFF(dd, ehrt.birthDate, GETDATE()) / 365.25 AS INT) AS 'Edad'
    ,(
        SELECT ucas.name FROM userConfAdministrativeSex AS ucas
        WHERE ucas.idAdministrativeSex = ehrt.idGenere
    )                                                         AS 'Sexo'
    ,IIF(ehrt.idEncounter IS NULL, uint.businessName,
        (SELECT uin.businessName
         FROM encounters AS ei
         INNER JOIN encounterRecords AS er  ON (ei.idEncounter  = er.idEncounter)
         INNER JOIN contracts        AS ci  ON (ci.idContract   = er.idPrincipalContract)
         INNER JOIN users            AS uin ON (uin.idUser      = c.idUserContractee)
         WHERE ei.idEncounter = e.idEncounter)
    )                                                         AS 'Aseguradora'
    ,IIF(ehrt.idEncounter IS NULL, c.name,
        (SELECT cc.name
         FROM encounters AS ec
         INNER JOIN encounterRecords AS er ON (ec.idEncounter = er.idEncounter)
         INNER JOIN contracts        AS cc ON (cc.idContract  = er.idPrincipalContract)
         WHERE ec.idEncounter = e.idEncounter)
    )                                                         AS 'Contrato'
    ,IIF(ehrt.idEncounter IS NULL, cp.name,
        (SELECT cp.name
         FROM encounters AS ep
         INNER JOIN encounterRecords AS er  ON (ep.idEncounter  = er.idEncounter)
         INNER JOIN contractPlans    AS cp  ON (er.idPrincipalContract = cp.idContract AND cp.idPlan = er.idPrincipalPlan)
         WHERE ep.idEncounter = e.idEncounter)
    )                                                         AS 'Plan'
    ,CONVERT(varchar(10), ehrt.dateStartTriage, 23)          AS 'FechaTriage'
    ,CAST(ehrt.dateStartTriage AS time)                       AS 'HoraTriage'
    ,CONCAT_WS(' ', us.givenName, us.familyName)             AS 'ProfesionalIniciaTriage'
    ,CONCAT_WS(' ', uprac.givenName, uprac.familyName)       AS 'ProfesionalClasifica'
    ,pl.name                                                  AS 'UbicacionTriage'
    ,IIF(ehrt.isPatientMissing = 0, NULL, 'X')               AS 'PacienteNoResponde'
    ,(SELECT ehrcesi.name FROM EHRConfESI AS ehrcesi
      WHERE ehrt.idESI = ehrcesi.idESI)                       AS 'ClasificacionTriage'
    ,CONVERT(varchar(10), ehrt.dateClassification, 23)       AS 'FechaClasificacion'
    ,CAST(ehrt.dateClassification AS time)                    AS 'HoraClasificacion'
    ,IIF(e.idDischargeLocation = NULL, NULL,
        (SELECT CONVERT(varchar(10), MAX(ehr.dateEnd), 23)
         FROM encounters AS edd
         INNER JOIN encounterHistoricalRecords AS ehr ON (edd.idEncounter = ehr.idEncounter)
         INNER JOIN physicalLocations AS pldd ON (pldd.idPhysicalLocation = ehr.idLocation)
         WHERE edd.idStatus <> 5 AND pldd.name LIKE '%URGENCIA%' AND ehr.idEncounter = ehrt.idEncounter)
    )                                                         AS 'FechaEgreso'
    ,IIF(e.idDischargeLocation = NULL, NULL,
        (SELECT CAST(MAX(ehr.dateEnd) AS time)
         FROM encounters AS edd
         INNER JOIN encounterHistoricalRecords AS ehr ON (edd.idEncounter = ehr.idEncounter)
         INNER JOIN physicalLocations AS pldd ON (pldd.idPhysicalLocation = ehr.idLocation)
         WHERE edd.idStatus <> 5 AND pldd.name LIKE '%URGENCIA%' AND ehr.idEncounter = ehrt.idEncounter)
    )                                                         AS 'HoraEgreso'
    ,IIF(e.idEncounter = NULL, NULL,
        DATEDIFF(HOUR, e.dateStart,
            (SELECT MAX(ehr.dateEnd)
             FROM encounters AS edd
             INNER JOIN encounterHistoricalRecords AS ehr ON (edd.idEncounter = ehr.idEncounter)
             INNER JOIN physicalLocations AS pldd ON (pldd.idPhysicalLocation = ehr.idLocation)
             WHERE edd.idStatus <> 5 AND pldd.name LIKE '%URGENCIA%' AND ehr.idEncounter = ehrt.idEncounter)
        )
    )                                                         AS 'EstanciaTotalUrgencias'
    ,DATEDIFF(MINUTE, ehrt.dateStartTriage, ehrt.dateClassification) AS 'TiempoClasificacion(minutos)'
    ,ehrced.name                                              AS 'DestinoClasificacion'
    ,e.identifier                                             AS 'Ingreso'
    ,CONVERT(varchar(10), e.dateStart, 23)                   AS 'FechaIngreso'
    ,CAST(e.dateStart AS time)                                AS 'HoraIngreso'
    ,plo.name                                                 AS 'UbicacionOrigen'
    ,DATEDIFF(MINUTE, ehrt.dateClassification, e.dateStart)  AS 'TiempoClasificacionIngreso(minutos)'
    ,(SELECT CONCAT_WS(' ', u.givenName, u.familyName)
      FROM EHREvents AS ehre
      INNER JOIN users AS u ON (u.idUser = ehre.idPractitioner)
      WHERE ehre.idAction = 382 AND ehre.idEncounter = e.idEncounter
      ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY
    )                                                         AS 'ProfesionalConsultaInicialUrgencias'
    ,(SELECT CONVERT(varchar(10), ehre.actionRecordedDate, 23)
      FROM EHREvents AS ehre
      WHERE ehre.idAction = 382 AND ehre.idEncounter = e.idEncounter
      ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY
    )                                                         AS 'FechaConsultaInicialUrgencias'
    ,UrgenciasInicial.HoraInicio                             AS 'HoraInicioConsultaInicialUrgencias'
    ,UrgenciasInicial.HoraFin                                AS 'HoraFinConsultaInicialUrgencias'
    ,UrgenciasInicial.DuracionMinutos                        AS 'DuracionConsultaMinutos'
    ,DATEDIFF(MINUTE, ehrt.dateClassification,
        (SELECT ehre.actionRecordedDate
         FROM EHREvents AS ehre
         WHERE ehre.idAction = 382 AND ehre.idEncounter = e.idEncounter
         ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY)
    )                                                        AS 'TiempoEsperaConsultaInicial(minutos) - DesdeLaClasificacion'
    ,(SELECT ehrced.name
      FROM EHREvents AS ehre
      INNER JOIN EHREventMedicalCarePlan  AS ehremcp ON (ehre.idEHREvent = ehremcp.idEHREvent)
      INNER JOIN EHRConfEventDestination  AS ehrced  ON (ehrced.idEventDestination = ehremcp.idEventDestination)
      WHERE ehre.idAction = 382 AND ehre.idEncounter = e.idEncounter
      ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY
    )                                                        AS 'DestinoConsultaInicialUrgencias'
    ,(SELECT CONCAT_WS(' ', u.givenName, u.familyName)
      FROM EHREvents AS ehre
      INNER JOIN users AS u ON (u.idUser = ehre.idPractitioner)
      WHERE ehre.idAction = 607 AND ehre.idEncounter = e.idEncounter
      ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY
    )                                                        AS 'ProfesionalPrimeraEvolucionUrgencias'
    ,(SELECT CONVERT(varchar(10), ehre.actionRecordedDate, 23)
      FROM EHREvents AS ehre
      WHERE ehre.idAction = 607 AND ehre.idEncounter = e.idEncounter
      ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY
    )                                                        AS 'FechaPrimeraEvolucionUrgencias'
    ,DATEDIFF(HOUR,
        (SELECT ehre.actionRecordedDate FROM EHREvents AS ehre
         WHERE ehre.idAction = 382 AND ehre.idEncounter = e.idEncounter
         ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY),
        (SELECT ehre.actionRecordedDate FROM EHREvents AS ehre
         WHERE ehre.idAction = 607 AND ehre.idEncounter = e.idEncounter
         ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY)
    )                                                        AS 'TiempoRevaloracion(horas)'
    ,(SELECT ehrced.name
      FROM EHREvents AS ehre
      INNER JOIN EHREventMedicalCarePlan  AS ehremcp ON (ehre.idEHREvent = ehremcp.idEHREvent)
      INNER JOIN EHRConfEventDestination  AS ehrced  ON (ehrced.idEventDestination = ehremcp.idEventDestination)
      WHERE ehre.idAction = 607 AND ehre.idEncounter = e.idEncounter
      ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY
    )                                                        AS 'DestinoPrimeraEvolucionUrgencias'
    ,DATEDIFF(MINUTE,
        (SELECT ehre.actionRecordedDate
         FROM EHREvents AS ehre
         WHERE ehre.idEncounter = e.idEncounter
           AND ehre.idEHREvent IN (SELECT ehremd.idEHREvent FROM EHREventMedicalDiagnostics AS ehremd WHERE ehre.idEHREvent = ehremd.idEHREvent)
         ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY),
        ISNULL(
            (SELECT ehre.actionRecordedDate
             FROM EHREvents AS ehre
             INNER JOIN EHREventMedicalCarePlan AS ehremcp ON (ehre.idEHREvent = ehremcp.idEHREvent)
             WHERE ehremcp.idEventDestination IN (15,24,25,28) AND ehre.idEncounter = e.idEncounter
             ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY),
            ISNULL(
                (SELECT MAX(ehr.dateEnd)
                 FROM encounterHistoricalRecords AS ehr
                 INNER JOIN physicalLocations AS plls ON (plls.idPhysicalLocation = ehr.idLocation)
                 WHERE plls.name LIKE '%URGENCIA%' AND ehr.idEncounter = ehrt.idEncounter),
                GETDATE()
            )
        )
    )                                                        AS 'TiempoEstanciaEnUrgencias(minutos)'
    ,DATEDIFF(HOUR,
        (SELECT ehre.actionRecordedDate
         FROM EHREvents AS ehre
         INNER JOIN EHREventMedicalCarePlan AS ehremcp ON (ehre.idEHREvent = ehremcp.idEHREvent)
         WHERE ehremcp.idEventDestination IN (15,24,25,28) AND ehre.idEncounter = e.idEncounter
         ORDER BY ehre.actionRecordedDate ASC OFFSET 0 ROWS FETCH NEXT 1 ROW ONLY),
        (SELECT MAX(ehr.dateEnd)
         FROM encounterHistoricalRecords AS ehr
         INNER JOIN physicalLocations AS plth ON (plth.idPhysicalLocation = ehr.idLocation)
         WHERE plth.name LIKE '%URGENCIA%' AND ehr.idEncounter = ehrt.idEncounter)
    )                                                        AS 'TiempoEnUrgenciasParaInternacion(horas)'
    ,(SELECT STRING_AGG(Diagnostico, CHAR(10)) FROM
        (SELECT DISTINCT CONCAT_WS(' - ', d.code, d.name) AS Diagnostico
         FROM encounters AS ed
         INNER JOIN encounterRecords AS er ON (ed.idEncounter = er.idEncounter)
         INNER JOIN diagnostics AS d ON (d.idDiagnostic = er.idActualDiagnosis)
         WHERE ed.idEncounter = e.idEncounter) AS SingleCell
    )                                                        AS 'DiagnosticoPrincipal'
    ,DATEPART(DAY,     ehrt.dateStartTriage)                 AS '#dia'
    ,DATEPART(MONTH,   ehrt.dateStartTriage)                 AS 'mes'
    ,DATEPART(HOUR,    ehrt.dateStartTriage)                 AS 'hora'
    ,CASE DATEPART(WEEKDAY, ehrt.dateStartTriage)
        WHEN 1 THEN 'LUN' WHEN 2 THEN 'MAR' WHEN 3 THEN 'MIE'
        WHEN 4 THEN 'JUE' WHEN 5 THEN 'VIE' WHEN 6 THEN 'SAB'
        WHEN 7 THEN 'DOM'
     END                                                     AS 'Ndia'
FROM EHRTriage AS ehrt
INNER JOIN physicalLocations         AS pl    ON (pl.idPhysicalLocation  = ehrt.idPhysicalLocation)
LEFT  JOIN contracts                 AS c     ON (c.idContract           = ehrt.idContract)
LEFT  JOIN contractPlans             AS cp    ON (c.idContract           = cp.idContract AND cp.idPlan = ehrt.idPlan)
LEFT  JOIN users                     AS uint  ON (uint.idUser            = ehrt.idInsuranceCompany)
LEFT  JOIN users                     AS us    ON (us.idUser              = ehrt.idUserStart)
LEFT  JOIN userConfTypeDocuments     AS uctd  ON (uctd.idTypeDocument    = us.idDocumentType)
LEFT  JOIN users                     AS uprac ON (uprac.idUser           = ehrt.idPractitioner)
LEFT  JOIN encounters                AS e     ON (e.idEncounter          = ehrt.idEncounter AND e.idStatus <> 5)
LEFT  JOIN physicalLocations         AS plo   ON (plo.idPhysicalLocation = e.idOriginLocation)
LEFT  JOIN EHRConfEventDestination   AS ehrced ON (ehrced.idEventDestination = ehrt.idDestination)
OUTER APPLY (
    SELECT TOP 1
        CAST(ehre.actionRecordedDate AS time)    AS HoraInicio,
        CAST(ehre.endRecordedDate    AS time(0)) AS HoraFin,
        DATEDIFF(MINUTE, ehre.actionRecordedDate, ehre.endRecordedDate) AS DuracionMinutos
    FROM EHREvents AS ehre
    WHERE ehre.idAction = 382 AND ehre.idEncounter = e.idEncounter
    ORDER BY ehre.actionRecordedDate ASC
) AS UrgenciasInicial
-- ── Filtro horario (Colombia local time) ────────────────────────
-- Incluye tanto los triages iniciados en la ventana como los clasificados
-- en la ventana: la clasificación (ClasificacionTriage) casi nunca está
-- lista en el instante del triage, sino minutos/horas después. Sin esta
-- segunda condición, un registro capturado antes de ser clasificado
-- (sync_key = triage:documento:fecha:hora, sin idEncounter todavía) nunca
-- se vuelve a consultar y queda congelado para siempre con clasificación NULL.
WHERE (ehrt.dateStartTriage    >= CONVERT(datetime, @StartDate) AND ehrt.dateStartTriage    < CONVERT(datetime, @EndDate))
   OR (ehrt.dateClassification >= CONVERT(datetime, @StartDate) AND ehrt.dateClassification < CONVERT(datetime, @EndDate));
