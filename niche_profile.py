#!/usr/bin/env python3
"""
niche_profile.py — Load and validate niche profile JSON files from niches/.

Usage:
  from niche_profile import load_niche, NicheProfile

  profile = load_niche("finance")
  print(profile.section_labels)
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

NICHES_DIR = Path(__file__).parent / "niches"


@dataclass
class NicheCrawlConfig:
    include_sections: list[str] = field(default_factory=list)
    min_chars: int = 0
    smart_actions: bool = False


@dataclass
class NicheSiteConfig:
    theme: str = "alpha"
    contact_path: str = "/kontakty/"


@dataclass
class NicheCta:
    article_question: str = "Есть вопросы?"
    article_btn: str = "Задать вопрос"
    sidebar_title: str = "Нужна помощь?"
    sidebar_desc: str = "Свяжитесь с нами."
    sidebar_btn: str = "Получить консультацию"


@dataclass
class NicheProfile:
    niche_id: str
    label: str
    description: str
    crawl: NicheCrawlConfig
    site: NicheSiteConfig
    section_labels: dict[str, str]
    section_label_variants: dict[str, list[str]]
    tags_dict: dict[str, list[str]]
    brand_voice_prompt: str
    schema_types: list[str]
    meta_templates: list[str]
    niche_cta: NicheCta = field(default_factory=NicheCta)

    def label_for(self, section: str, variant_index: int = 0) -> str:
        """Return a section label, optionally picking a variation for footprint diversity."""
        if section in self.section_label_variants:
            variants = self.section_label_variants[section]
            return variants[variant_index % len(variants)]
        return self.section_labels.get(section, section.replace("-", " ").capitalize())

    def meta_description(self, h1: str, year: int | str = "") -> str:
        """Render first meta template for a page."""
        template = self.meta_templates[0] if self.meta_templates else "{h1}"
        return template.format(h1=h1, year=year)


def load_niche(niche_id: str) -> NicheProfile:
    """Load and parse a niche profile from niches/<niche_id>.json."""
    path = NICHES_DIR / f"{niche_id}.json"
    if not path.exists():
        available = [p.stem for p in NICHES_DIR.glob("*.json")]
        raise FileNotFoundError(
            f"Niche profile '{niche_id}' not found. Available: {available}"
        )

    data = json.loads(path.read_text(encoding="utf-8"))

    crawl_raw = data.get("crawl", {})
    site_raw = data.get("site", {})

    return NicheProfile(
        niche_id=data["niche_id"],
        label=data.get("label", niche_id),
        description=data.get("description", ""),
        crawl=NicheCrawlConfig(
            include_sections=crawl_raw.get("include_sections", []),
            min_chars=crawl_raw.get("min_chars", 0),
            smart_actions=crawl_raw.get("smart_actions", False),
        ),
        site=NicheSiteConfig(
            theme=site_raw.get("theme", "alpha"),
            contact_path=site_raw.get("contact_path", "/kontakty/"),
        ),
        section_labels=data.get("section_labels", {}),
        section_label_variants=data.get("section_label_variants", {}),
        tags_dict=data.get("tags_dict", {}),
        brand_voice_prompt=data.get("brand_voice_prompt", ""),
        schema_types=data.get("schema_types", []),
        meta_templates=data.get("meta_templates", []),
        niche_cta=NicheCta(**{
            k: v for k, v in data.get("niche_cta", {}).items()
            if k in NicheCta.__dataclass_fields__
        }),
    )


def list_niches() -> list[str]:
    """Return available niche IDs."""
    return sorted(p.stem for p in NICHES_DIR.glob("*.json"))
