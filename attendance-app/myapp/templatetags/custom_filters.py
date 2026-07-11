from django import template

register = template.Library()

@register.filter
def initials(value):
    if not value:
        return ""

    words = value.strip().split()

    if len(words) >= 2:
        return (words[0][0] + words[-1][0]).upper()

    return words[0][:2].upper()
