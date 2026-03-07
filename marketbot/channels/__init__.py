"""Chat channels module with plugin architecture."""

from marketbot.channels.base import BaseChannel
from marketbot.channels.manager import ChannelManager

__all__ = ["BaseChannel", "ChannelManager"]
