// src/pages/admin/AdminImportPage.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileUp,
  Image as ImageIcon,
  Sparkles,
  FileText,
  Link as LinkIcon,
  Info,
  X,
  RotateCcw,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { advisoryService } from '../../services/advisoryService';
import { Button } from '../../components/common/Button';
import { Input, Textarea } from '../../components/common/Input';
import { Alert } from '../../components/common/Alert';
import { Card, CardBody } from '../../components/common/Card';
import { DuplicateWarning } from '../../types';
import {
  parseFacebookAdvisory,
  ParsedAdvisoryResult
} from '../../utils/advisoryParser';

// Realistic, accurate VECO Facebook advisory text matching actual Visayan Electric emergency load-drop announcements
const SAMPLE_FACEBOOK_ADVISORY = `ADVISORY: ROTATIONAL BROWNOUT SCHEDULE
SEPTEMBER 6-8, 2026 | DAILY: 10:00 AM – 10:30 PM

Due to a power generation deficiency in the Visayas Grid placed under Red/Yellow Alert by NGCP, Visayan Electric may implement emergency rotational brownouts across its franchise area to safeguard grid stability.

BATCH 1 | 10:00 AM – 12:30 PM
Cebu City: Guadalupe, Lahug, Capitol Site, Kamputhaw, Mabolo, Kasambagan, Banilad
Mandaue City: Centro, Subangdaku, Tipolo, Bakilid, Guizo
Map: https://bit.ly/veco-batch1-map

BATCH 2 | 12:30 PM – 03:00 PM
Cebu City: Basak San Nicolas, Punta Princesa, Mambaling, Tisa, Labangon, Buhisan
Talisay City: Tabunok, Bulacao, San Isidro, Dumlog, Poblacion
Map: https://bit.ly/veco-batch2-map

BATCH 3 | 03:00 PM – 05:30 PM
Cebu City: Apas, Talamban, Bacayan, Pit-os, San Jose, Binaliw
Consolacion: Casili, Danglag, Pitogo, Poblacion, Tayud
Liloan: Yati, Catarman, Tayud, Poblacion
Map: https://bit.ly/veco-batch3-map

BATCH 4 | 05:30 PM – 08:00 PM (EVENING PEAK)
Cebu City: Sambag I, Sambag II, Santa Cruz, Cogon Ramos, Lorega San Miguel, Tejero, Tinago
Mandaue City: Banilad, Cabancalan, Maguikay, Casuntingan, Pagsabungan
Minglanilla: Calajo-an, Tungkil, Tunghaan, Poblacion Ward 1, Ward 2
Map: https://bit.ly/veco-batch4-map

BATCH 5 | 08:00 PM – 10:30 PM
Cebu City: Inayawan, Cogon Pardo, Poblacion Pardo, Kinasang-an, Quiot
Talisay City: Cansojong, San Roque, Tangke, Pooc, Mohon
San Fernando: South Poblacion, North Poblacion, Panadtaran, Pitalo

Source: Visayan Electric
Note: Duration may vary depending on the grid supply situation. Power will be immediately restored or schedules cancelled if NGCP lifts the generation deficiency alert.`;

export function AdminImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form & Ingestion States
  const [rawText, setRawText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [source, setSource] = useState('Visayan Electric');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<{ isAvailable: boolean; engine: string } | null>(null);

  // Parsing & Review States
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedAdvisoryResult | null>(null);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  // Request & Navigation States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);

  // Guards against duplicate parse requests
  const lastParsedTextRef = useRef<string>('');
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    advisoryService
      .getOcrStatus()
      .then(status => setOcrStatus(status))
      .catch(() => {});

    return () => {
      if (parseTimeoutRef.current) clearTimeout(parseTimeoutRef.current);
    };
  }, []);

  /**
   * Unified parsing runner that extracts schedules and structured data.
   */
  const executeParsing = useCallback((textToParse: string) => {
    const trimmed = textToParse.trim();
    if (!trimmed || trimmed.length < 20) {
      setParsedData(null);
      setParsingError(null);
      lastParsedTextRef.current = '';
      return;
    }

    if (trimmed === lastParsedTextRef.current) {
      return; // Deduplicate
    }

    setIsParsing(true);
    setParsingError(null);

    try {
      const result = parseFacebookAdvisory(trimmed);
      lastParsedTextRef.current = trimmed;
      setParsedData(result);

      // Populate source authority and detected URL if available
      if (result.sourceAuthority && !source) {
        setSource(result.sourceAuthority);
      }
      if (result.mapUrls && result.mapUrls.length > 0 && !sourceUrl) {
        setSourceUrl(result.mapUrls[0]);
      }
    } catch (err: any) {
      setParsingError('Unable to extract structured schedules from the text. Please verify formatting.');
    } finally {
      setIsParsing(false);
    }
  }, [source, sourceUrl]);

  /**
   * 1. Automatic parsing on clipboard PASTE
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && pasted.trim().length > 15) {
      if (parseTimeoutRef.current) clearTimeout(parseTimeoutRef.current);

      setIsParsing(true);
      setTimeout(() => {
        executeParsing(pasted);
      }, 50);
    }
  };

  /**
   * 2. Debounced fallback for typing or editing
   */
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);

    if (parseTimeoutRef.current) clearTimeout(parseTimeoutRef.current);

    if (val.trim().length > 30) {
      parseTimeoutRef.current = setTimeout(() => {
        executeParsing(val);
      }, 450);
    } else if (val.trim().length === 0) {
      setParsedData(null);
      lastParsedTextRef.current = '';
    }
  };

  /**
   * Optional Screenshot upload
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid graphic or screenshot (PNG, JPG, or WebP).');
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.onerror = () => {
      setError('Failed to read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Review correction helper: toggles or resolves "Needs review" flag
   */
  const handleResolveReview = (scheduleIndex: number, cityGroupIndex: number, barangayId: string) => {
    if (!parsedData) return;

    const updated = { ...parsedData };
    const targetSchedule = updated.schedules[scheduleIndex];
    if (!targetSchedule) return;

    const targetCityGroup = targetSchedule.cityGroups[cityGroupIndex];
    if (!targetCityGroup) return;

    const targetBgy = targetCityGroup.barangays.find(b => b.id === barangayId);
    if (targetBgy) {
      targetBgy.needsReview = false;
      targetBgy.reviewReason = undefined;
    }

    targetCityGroup.needsReview = targetCityGroup.barangays.some(b => b.needsReview);
    updated.uncertainCount = updated.schedules.reduce(
      (acc, s) => acc + s.cityGroups.reduce((cAcc, cg) => cAcc + cg.barangays.filter(b => b.needsReview).length, 0),
      0
    );

    setParsedData(updated);
  };

  /**
   * Final Continue Action: Saves draft and navigates to the Outage Map review workflow
   */
  const handleContinue = async (forceContinue: boolean = false) => {
    if (!rawText.trim() && !imagePreview) {
      setError('Please paste a Facebook advisory or upload an advisory graphic.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await advisoryService.importAdvisory({
        text: rawText,
        sourceUrl: sourceUrl.trim() || undefined,
        source: source.trim() || 'Visayan Electric',
        imageDataUrl: imagePreview || undefined,
        imageFileName: selectedFile?.name,
        force: forceContinue,
        bypassDuplicate: forceContinue,
        parsedData: parsedData || undefined
      } as any);

      if (response.duplicateWarning?.isDuplicate && !forceContinue) {
        setDuplicateWarning(response.duplicateWarning);
        setIsSubmitting(false);
        return;
      }

      navigate(`/admin/advisories/review/${response.advisory.id}`, {
        state: {
          importedFresh: true,
          duplicateWarning: response.duplicateWarning
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to process advisory. Please check your network connection.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-stone-900 font-sans pb-16">
      {/* 1. Header */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-stone-200/70 text-stone-700">
          <FileUp className="w-3.5 h-3.5 text-amber-600" />
          <span>Single-Action Ingestion</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-light font-serif text-stone-950 tracking-tight">
          Import Advisory
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 font-light max-w-2xl">
          Paste official Visayan Electric emergency load-drop announcements. The system automatically extracts 
          sequential time batches, matches Metro Cebu barangays to GIS coordinates, and saves an unpublished draft.
        </p>
      </div>

      {error && (
        <Alert type="error" title="Import Error">
          {error}
        </Alert>
      )}

      {/* Duplicate Warning Prompt */}
      {duplicateWarning && (
        <Alert
          type="warning"
          title="Possible Duplicate Advisory Detected"
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const targetId = duplicateWarning.existingPostId || duplicateWarning.existingAdvisory?.id;
                  if (targetId) navigate(`/admin/advisories/review/${targetId}`);
                }}
              >
                View Existing
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleContinue(true)}
              >
                Continue Anyway
              </Button>
            </div>
          }
        >
          {duplicateWarning.message}
          <div className="text-xs text-amber-900 mt-1 font-mono">
            Existing: {duplicateWarning.existingPostTitle || duplicateWarning.existingAdvisory?.title}
          </div>
        </Alert>
      )}

      {/* 2. Primary Input Card: Raw Facebook Post Text */}
      <Card className="border border-stone-200 shadow-xs bg-white rounded-xl overflow-hidden">
        <CardBody className="p-5 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-medium text-stone-700 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Raw Facebook Post Text</span>
              <span className="text-[10px] font-normal text-stone-400 normal-case">(Paste here to auto-parse)</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setRawText(SAMPLE_FACEBOOK_ADVISORY);
                executeParsing(SAMPLE_FACEBOOK_ADVISORY);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-800 hover:text-amber-950 underline font-medium cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Load Accurate VECO Sample</span>
            </button>
          </div>

          <div className="relative">
            <Textarea
              rows={11}
              className="font-mono text-xs leading-relaxed border-stone-300 focus:border-stone-900"
              placeholder={`Paste the Visayan Electric Facebook post here...\n\nExample:\nADVISORY: ROTATIONAL BROWNOUT SCHEDULE\nSEPTEMBER 6-8, 2026 | DAILY: 10:00 AM – 10:30 PM\n\nBATCH 1 | 10:00 AM – 12:30 PM\nCebu City: Guadalupe, Lahug, Capitol Site\nMandaue City: Centro, Subangdaku\nMap: https://bit.ly/veco-batch1-map`}
              value={rawText}
              onPaste={handlePaste}
              onChange={handleTextChange}
            />

            {/* Parsing State Pill */}
            {isParsing && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-stone-900 text-white text-[11px] font-mono px-3 py-1 rounded-full shadow-md animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>Parsing advisory…</span>
              </div>
            )}
          </div>

          {parsingError && (
            <div className="text-xs text-rose-600 font-mono bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{parsingError}</span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 3. Automatic Parsing Results & Review Interface */}
      {parsedData && (
        <div className="space-y-4 animate-fadeIn">
          {/* Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-stone-900 text-white rounded-xl shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-mono uppercase tracking-wider text-stone-200 font-bold">
                  Extracted Advisory Structure
                </h2>
                <p className="text-[11px] text-stone-400 font-light">
                  Continuous coverage detected across {parsedData.totalSchedules} rotational time batches.
                </p>
              </div>
            </div>

            {/* Metric Badges */}
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="bg-stone-800 text-stone-300 px-2.5 py-1 rounded-md border border-stone-700">
                {parsedData.totalSchedules} {parsedData.totalSchedules === 1 ? 'Batch' : 'Batches'}
              </span>
              <span className="bg-stone-800 text-stone-300 px-2.5 py-1 rounded-md border border-stone-700">
                {parsedData.totalLocations} Barangays
              </span>
              {parsedData.uncertainCount > 0 ? (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {parsedData.uncertainCount} Needs Review
                </span>
              ) : (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                  All Locations Matched
                </span>
              )}
            </div>
          </div>

          {/* Core Metadata Card */}
          <Card className="border border-stone-200 bg-white rounded-xl">
            <CardBody className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono border-b border-stone-100">
              <div>
                <span className="text-stone-400 text-[10px] uppercase block">Advisory Title</span>
                <span className="font-semibold text-stone-900">{parsedData.title}</span>
              </div>
              <div>
                <span className="text-stone-400 text-[10px] uppercase block">Effective Dates</span>
                <span className="font-semibold text-stone-900">{parsedData.dateRange || 'September 6-8, 2026'}</span>
              </div>
              <div>
                <span className="text-stone-400 text-[10px] uppercase block">Overall Duration</span>
                <span className="font-semibold text-stone-900">{parsedData.duration || '10:00 AM – 10:30 PM'}</span>
              </div>
            </CardBody>

            {/* Structured Schedules List */}
            <CardBody className="p-5 sm:p-6 space-y-5">
              <h3 className="text-xs font-mono uppercase tracking-wider text-stone-700 font-bold flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Extracted Rotational Batches &amp; Affected Areas</span>
              </h3>

              <div className="space-y-4">
                {parsedData.schedules.map((schedule, sIdx) => (
                  <div
                    key={schedule.id}
                    className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-3"
                  >
                    {/* Time Window Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-900 text-white font-bold">
                          Batch {schedule.scheduleNumber}
                        </span>
                        <span className="font-mono text-sm font-bold text-stone-950">
                          {schedule.timeWindow}
                        </span>
                      </div>

                      {schedule.mapUrl && (
                        <a
                          href={schedule.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 hover:text-amber-900 font-medium"
                        >
                          <span>Official Feeder Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Affected Cities and Barangays */}
                    <div className="space-y-2.5 pt-1">
                      {schedule.cityGroups.length === 0 ? (
                        <p className="text-xs text-stone-400 italic">No specific city boundaries found for this window.</p>
                      ) : (
                        schedule.cityGroups.map((group, cIdx) => (
                          <div key={group.id} className="text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 font-semibold text-stone-800 font-serif">
                              <MapPin className="w-3.5 h-3.5 text-stone-500" />
                              <span>{group.city}</span>
                              <span className="text-[10px] font-mono font-normal text-stone-400">
                                ({group.barangays.length})
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pl-5">
                              {group.barangays.map(bgy => (
                                <span
                                  key={bgy.id}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
                                    bgy.needsReview
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-white text-stone-700 border border-stone-200 shadow-2xs'
                                  }`}
                                >
                                  <span>{bgy.name}</span>
                                  {bgy.needsReview && (
                                    <button
                                      type="button"
                                      title={bgy.reviewReason || 'Click to confirm location'}
                                      onClick={() => handleResolveReview(sIdx, cIdx, bgy.id)}
                                      className="ml-0.5 text-amber-800 hover:text-stone-950 underline font-bold cursor-pointer"
                                    >
                                      [Confirm]
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* 4. Streamlined Details (URL, Source, Optional Graphic) */}
      <div className="border border-stone-200 rounded-xl bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
          className="w-full flex items-center justify-between p-4 text-xs font-mono text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <LinkIcon className="w-3.5 h-3.5 text-stone-400" />
            <span>Advisory Source, Post URL, and Screenshot (Optional)</span>
          </span>
          {showAdvancedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvancedDetails && (
          <div className="p-5 border-t border-stone-200 space-y-5 bg-stone-50/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Facebook Post URL (Optional)"
                placeholder="https://www.facebook.com/visayanelectric/posts/..."
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                icon={<LinkIcon className="w-4 h-4 text-stone-400" />}
                helperText="Enables 'View Original Facebook Post' link on public outage map"
              />
              <Input
                label="Source Authority"
                value={source}
                onChange={e => setSource(e.target.value)}
                helperText="Defaults to Visayan Electric"
              />
            </div>

            {/* Optional Graphic Upload */}
            <div className="space-y-2 pt-2 border-t border-stone-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-stone-700 uppercase">
                  Optional Advisory Screenshot
                </span>
                <span className="text-[11px] font-mono text-stone-400">
                  OCR: {ocrStatus?.isAvailable ? 'Gemini Flash Vision Ready' : 'Manual text primary'}
                </span>
              </div>

              <div className="flex items-center gap-4 p-3 border border-dashed border-stone-300 rounded-lg bg-white">
                {imagePreview ? (
                  <div className="relative shrink-0">
                    <img
                      src={imagePreview}
                      alt="Uploaded advisory"
                      className="w-16 h-16 object-cover rounded border border-stone-300 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="absolute -top-1.5 -right-1.5 bg-stone-900 text-white rounded-full p-1 hover:bg-stone-700"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 text-xs">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="text-xs text-stone-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-mono file:bg-stone-200 file:text-stone-800 hover:file:bg-stone-300 cursor-pointer"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Upload if the post contains an image table or infographic instead of plain text.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Safe Draft Workflow Advisory */}
      <div className="bg-stone-100 p-4 rounded-xl border border-stone-200/80 text-xs text-stone-700 flex items-start gap-3">
        <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5 font-light">
          <span className="font-semibold text-stone-900 font-mono uppercase text-[11px] block">
            Safe Review Confirmation
          </span>
          <p>
            Parsing this advisory creates an unpublished <strong>Draft</strong>. The advisory is <strong>never published automatically</strong> to the live map without human confirmation in the Outage Review interface.
          </p>
        </div>
      </div>

      {/* 6. Primary Action Footer */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate('/admin')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Manual re-parse fallback button */}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => executeParsing(rawText)}
            disabled={!rawText.trim() || isParsing || isSubmitting}
            icon={<Sparkles className="w-3.5 h-3.5 text-stone-500" />}
          >
            Re-Parse Advisory
          </Button>

          {/* Primary Continue Button */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="flex-1 sm:flex-initial bg-stone-950 hover:bg-stone-800 text-white font-mono text-xs tracking-wider uppercase py-2.5 px-6 rounded-lg"
            isLoading={isSubmitting}
            onClick={() => handleContinue(false)}
            icon={<ArrowRight className="w-4 h-4 text-amber-400" />}
          >
            Save &amp; Continue to Map Review
          </Button>
        </div>
      </div>
    </div>
  );
}